-- ============================================================================
-- Gala Night — 11. Flagging an order for refund
-- ============================================================================
-- Spec §10 gives the admin a "flag for refund" action, and §8 has the
-- system flag one itself when someone pays after their hold expired and the
-- tickets have already gone.
--
-- Both were writing only to audit_log. That is the right place for the
-- history, but a wrong place to ask "which orders need refunding?" — the
-- answer would mean scanning a log and hoping nothing was missed.
--
-- A column makes it a query, and a partial index makes it a fast one.
-- ============================================================================

alter table public.orders
  add column if not exists refund_requested_at timestamptz,
  add column if not exists refund_reason text;

-- Almost no orders are flagged, so index only the ones that are.
create index if not exists orders_refund_requested_idx
  on public.orders (refund_requested_at desc)
  where refund_requested_at is not null;

comment on column public.orders.refund_requested_at is
  'Set when an order needs money returned: flagged by an admin, or automatically when payment arrived after the hold expired and the tickets were gone. Clearing it marks the refund as handled.';


-- ── Teach the payment confirmation to set it ────────────────────────────────
-- Same function as migration 09, with the REFUND_REQUIRED branch now
-- writing the column as well as the audit row. Everything else is unchanged.

create or replace function public.confirm_order_payment(
  p_reference         text,
  p_payment_reference text,
  p_amount_kobo       integer,
  p_status            text,
  p_paid_at           timestamptz
)
returns table (
  outcome        text,
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
  -- Idempotency first: providers retry webhooks they think failed, and
  -- processing one twice would issue a second set of tickets.
  select * into v_existing
    from public.orders
   where payment_reference = p_payment_reference;

  if found then
    if v_existing.reference <> p_reference then
      raise exception 'Payment reference already used by another order'
        using errcode = 'GN104', detail = v_existing.reference;
    end if;

    return query
      select 'ALREADY_PROCESSED'::text,
             v_existing.id,
             (select count(*)::integer from public.tickets t where t.order_id = v_existing.id);
    return;
  end if;

  select * into v_order
    from public.orders
   where reference = p_reference
   for update;

  if not found then
    raise exception 'Order not found' using errcode = 'GN101', detail = p_reference;
  end if;

  if p_status = 'failed' then
    if v_order.status not in ('PENDING', 'EXPIRED') then
      raise exception 'Order cannot be marked failed from its current state'
        using errcode = 'GN102', detail = v_order.status::text;
    end if;

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

  if v_order.status not in ('PENDING', 'EXPIRED') then
    raise exception 'Order is not awaiting payment'
      using errcode = 'GN102', detail = v_order.status::text;
  end if;

  if p_amount_kobo <> v_order.total_kobo then
    raise exception 'Paid amount does not match the order total'
      using errcode = 'GN103',
            detail = p_amount_kobo::text || ' vs ' || v_order.total_kobo::text;
  end if;

  if v_order.status = 'EXPIRED' then
    select count(*)::integer into v_short
      from public.order_items oi
     where oi.order_id = v_order.id
       and oi.quantity > public.ticket_type_availability(oi.ticket_type_id);

    if v_short > 0 then
      update public.orders
         set payment_reference   = p_payment_reference,
             refund_requested_at = now(),
             refund_reason       = 'Paid after the hold expired; the tickets had already gone.'
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

revoke execute on function public.confirm_order_payment(text, text, integer, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.confirm_order_payment(text, text, integer, text, timestamptz)
  to service_role;
