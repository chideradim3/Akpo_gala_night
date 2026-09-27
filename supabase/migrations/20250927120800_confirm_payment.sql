-- ============================================================================
-- Gala Night — 09. Confirming payment and issuing tickets
-- ============================================================================
-- THE ONLY THING IN THE SYSTEM THAT MAY MARK AN ORDER PAID.
--
-- No page, button, redirect or return URL can do it (spec §3 rules 5 and 6).
-- It is reached from exactly one place: POST /api/payments/confirm, which
-- requires a valid HMAC signature.
--
-- Everything happens in one transaction: the order flips to PAID, its
-- tickets come into existence, and the audit rows are written. Either all of
-- that is true or none of it is. A crash halfway cannot leave a paid order
-- with no tickets, or tickets for an order that was never paid.
--
-- Error codes, mapped to messages in lib/services/orders.ts:
--   GN101  no order with that reference
--   GN102  order is in a state that cannot be paid
--   GN103  amount does not match the order total
--   GN104  that payment reference belongs to a different order
-- ============================================================================


-- ── Ticket issuance ─────────────────────────────────────────────────────────
-- One ticket per unit: quantity 3 of a tier produces 3 tickets, each with its
-- own code and QR token. A VIP table ticket admits ten people on one ticket,
-- so quantity — not `admits` — is what decides how many rows appear.
--
-- Only ever called from confirm_order_payment, inside its transaction.

create or replace function public.issue_tickets_for_order(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item        record;
  v_order       public.orders%rowtype;
  v_issued      integer := 0;
  v_unit        integer;
  v_attempt     integer;
  v_code        text;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'Order not found' using errcode = 'GN101';
  end if;

  -- Tickets exist only for PAID orders (spec §6).
  if v_order.status <> 'PAID' then
    raise exception 'Cannot issue tickets for an order that is not PAID'
      using errcode = 'GN102', detail = v_order.status::text;
  end if;

  for v_item in
    select id, ticket_type_id, quantity
      from public.order_items
     where order_id = p_order_id
     order by id
  loop
    for v_unit in 1..v_item.quantity loop
      -- ticket_code is short and random, so a collision is unlikely but not
      -- impossible. Retry rather than failing someone's paid order.
      v_attempt := 0;
      loop
        v_attempt := v_attempt + 1;
        v_code := public.generate_ticket_code();
        begin
          insert into public.tickets (
            order_id, order_item_id, ticket_type_id, attendee_id, ticket_code
          )
          values (
            p_order_id, v_item.id, v_item.ticket_type_id, v_order.attendee_id, v_code
          );
          exit;                                  -- inserted, next unit
        exception when unique_violation then
          if v_attempt >= 10 then
            raise exception 'Could not generate a unique ticket code after % attempts', v_attempt;
          end if;
          -- loop and try another code
        end;
      end loop;

      v_issued := v_issued + 1;
    end loop;
  end loop;

  return v_issued;
end;
$$;


-- ── Payment confirmation ────────────────────────────────────────────────────

create or replace function public.confirm_order_payment(
  p_reference         text,
  p_payment_reference text,
  p_amount_kobo       integer,
  p_status            text,          -- 'success' | 'failed'
  p_paid_at           timestamptz
)
returns table (
  outcome        text,               -- see below
  order_id       uuid,
  tickets_issued integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order     public.orders%rowtype;
  v_existing  public.orders%rowtype;
  v_issued    integer := 0;
  v_short     integer;
begin
  -- ── Idempotency, checked first ────────────────────────────────────────
  -- A payment provider will retry a webhook it thinks failed. Processing the
  -- same payment twice would issue a second set of tickets for one purchase,
  -- so the very first question is "have I seen this payment before?".
  select * into v_existing
    from public.orders
   where payment_reference = p_payment_reference;

  if found then
    if v_existing.reference <> p_reference then
      -- The same provider reference against a different order is not a
      -- retry, it is a mix-up. Refuse and let a human look.
      raise exception 'Payment reference already used by another order'
        using errcode = 'GN104', detail = v_existing.reference;
    end if;

    return query
      select 'ALREADY_PROCESSED'::text,
             v_existing.id,
             (select count(*)::integer from public.tickets t where t.order_id = v_existing.id);
    return;
  end if;

  -- ── Lock the order ────────────────────────────────────────────────────
  -- FOR UPDATE so two simultaneous confirmations for the same order cannot
  -- both get past the state check below.
  select * into v_order
    from public.orders
   where reference = p_reference
   for update;

  if not found then
    raise exception 'Order not found' using errcode = 'GN101', detail = p_reference;
  end if;

  -- ── Failure ───────────────────────────────────────────────────────────
  if p_status = 'failed' then
    if v_order.status not in ('PENDING', 'EXPIRED') then
      raise exception 'Order cannot be marked failed from its current state'
        using errcode = 'GN102', detail = v_order.status::text;
    end if;

    -- FAILED is not counted by ticket_type_availability, so recording the
    -- failure IS how the held seats are released. No separate step.
    update public.orders
       set status = 'FAILED', payment_reference = p_payment_reference
     where id = v_order.id;

    insert into public.audit_log (actor, action, details)
    values ('payment', 'order.failed',
            jsonb_build_object('reference', p_reference,
                               'payment_reference', p_payment_reference));

    return query select 'FAILED_RECORDED'::text, v_order.id, 0;
    return;
  end if;

  -- ── Success ───────────────────────────────────────────────────────────
  if v_order.status not in ('PENDING', 'EXPIRED') then
    raise exception 'Order is not awaiting payment'
      using errcode = 'GN102', detail = v_order.status::text;
  end if;

  -- Exact match only. A mismatch means the buyer was charged something other
  -- than what this order is for, and guessing which is right is not our call.
  if p_amount_kobo <> v_order.total_kobo then
    raise exception 'Paid amount does not match the order total'
      using errcode = 'GN103',
            detail = p_amount_kobo::text || ' vs ' || v_order.total_kobo::text;
  end if;

  -- A late payment on an EXPIRED order (spec §8). The hold lapsed, so the
  -- seats may have gone to someone else in the meantime. Take the money only
  -- if we can still honour it.
  if v_order.status = 'EXPIRED' then
    select count(*)::integer into v_short
      from public.order_items oi
     where oi.order_id = v_order.id
       and oi.quantity > public.ticket_type_availability(oi.ticket_type_id);

    if v_short > 0 then
      -- Cannot deliver. Record the payment against the order so it is
      -- traceable, leave the status alone, and flag it for a refund. No
      -- paid_at and no tickets — the buyer has not got anything.
      update public.orders
         set payment_reference = p_payment_reference
       where id = v_order.id;

      insert into public.audit_log (actor, action, details)
      values ('payment', 'order.refund_required',
              jsonb_build_object(
                'reference', p_reference,
                'payment_reference', p_payment_reference,
                'amount_kobo', p_amount_kobo,
                'reason', 'paid after the hold expired and the tickets were gone'));

      return query select 'REFUND_REQUIRED'::text, v_order.id, 0;
      return;
    end if;
  end if;

  update public.orders
     set status            = 'PAID',
         paid_at           = coalesce(p_paid_at, now()),
         payment_reference = p_payment_reference
   where id = v_order.id;

  v_issued := public.issue_tickets_for_order(v_order.id);

  insert into public.audit_log (actor, action, details)
  values
    ('payment', 'order.paid',
     jsonb_build_object('reference', p_reference,
                        'payment_reference', p_payment_reference,
                        'amount_kobo', p_amount_kobo)),
    ('payment', 'tickets.issued',
     jsonb_build_object('reference', p_reference, 'count', v_issued));

  return query select 'PAID'::text, v_order.id, v_issued;
end;
$$;


-- ── Grants ──────────────────────────────────────────────────────────────────
-- Server code only. The browser must never be able to reach either of these.
revoke execute on function public.issue_tickets_for_order(uuid) from public, anon, authenticated;
revoke execute on function public.confirm_order_payment(text, text, integer, text, timestamptz) from public, anon, authenticated;

grant execute on function public.issue_tickets_for_order(uuid) to service_role;
grant execute on function public.confirm_order_payment(text, text, integer, text, timestamptz) to service_role;


comment on function public.confirm_order_payment(text, text, integer, text, timestamptz) is
  'The only function that may mark an order PAID. Idempotent on payment_reference. Marks the order paid, issues one ticket per unit and writes the audit trail in a single transaction.';
