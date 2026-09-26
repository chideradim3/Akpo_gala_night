-- ============================================================================
-- Gala Night — 05. Inventory and atomic order creation
-- ============================================================================
-- This is the most important file in the schema. It is what stops two people
-- buying the last VIP table at the same moment.
-- ============================================================================


-- ── Availability ────────────────────────────────────────────────────────────
-- Always DERIVED, never stored (spec §5, §6):
--
--   available = inventory
--             − quantity in PAID orders
--             − quantity in PENDING orders that have not expired
--
-- The PENDING part is the "hold": while someone is at the payment page their
-- seats are not available to anyone else, and they are released automatically
-- the moment the order expires. No cleanup job is needed for correctness —
-- the expiry sweeper is only there to tidy the status column.

create or replace function public.ticket_type_availability(p_ticket_type_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select t.inventory - coalesce((
    select sum(oi.quantity)
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
     where oi.ticket_type_id = t.id
       and (
         o.status = 'PAID'
         or (o.status = 'PENDING' and o.expires_at > now())
       )
  ), 0)::integer
  from public.ticket_types t
  where t.id = p_ticket_type_id;
$$;


-- Bulk version for the checkout page and the admin dashboard: one round trip
-- instead of one per tier.
create or replace function public.event_ticket_availability(p_event_id uuid)
returns table (
  ticket_type_id uuid,
  inventory      integer,
  reserved       integer,
  available      integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    t.inventory,
    coalesce(r.reserved, 0)::integer,
    (t.inventory - coalesce(r.reserved, 0))::integer
  from public.ticket_types t
  left join lateral (
    select sum(oi.quantity) as reserved
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
     where oi.ticket_type_id = t.id
       and (
         o.status = 'PAID'
         or (o.status = 'PENDING' and o.expires_at > now())
       )
  ) r on true
  where t.event_id = p_event_id
  order by t.sort_order, t.name;
$$;


-- ── Atomic order creation ───────────────────────────────────────────────────
--
-- THE RACE THIS PREVENTS
--
-- One VIP table left. Two buyers press "Continue to payment" in the same
-- millisecond. Without locking, both read "1 available", both pass the check,
-- and both orders are created. You have sold a table that does not exist and
-- someone gets turned away at the door.
--
-- HOW IT IS PREVENTED
--
-- `SELECT … FOR UPDATE` takes a row lock on each ticket_types row before
-- reading availability. The second transaction blocks at that line until the
-- first has committed, and then reads the *updated* picture — 0 available —
-- and is correctly rejected.
--
-- The rows are locked in ascending id order. That matters: if one order locks
-- tier A then B while another locks B then A, they deadlock. Sorting gives
-- every transaction the same acquisition order, which makes that impossible.
--
-- Prices come from the ticket_types table, never from the caller. The caller
-- supplies only ticket_type_id and quantity (non-negotiable rule 2).
--
-- p_items: [{"ticket_type_id": "uuid", "quantity": 2}, …]
--
-- Error codes, mapped to friendly messages in lib/services/orders.ts:
--   GN001  not enough inventory left
--   GN002  quantity above max_per_order
--   GN003  sales not open for this tier
--   GN004  ticket type missing, inactive, or belongs to another event
--   GN005  empty or malformed selection

create or replace function public.create_order_with_reservation(
  p_event_id      uuid,
  p_attendee_id   uuid,
  p_items         jsonb,
  p_hold_minutes  integer default 30
)
returns table (
  order_id     uuid,
  reference    text,
  access_token text,
  total_kobo   integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item      record;
  v_type      public.ticket_types%rowtype;
  v_available integer;
  v_total     integer := 0;
  v_order_id  uuid;
begin
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'No tickets selected' using errcode = 'GN005';
  end if;

  if p_hold_minutes is null or p_hold_minutes < 1 then
    raise exception 'Invalid hold duration' using errcode = 'GN005';
  end if;

  -- ── Pass 1: lock, validate, and total up ─────────────────────────────────
  -- Nothing is written in this pass. If any tier fails, the whole function
  -- raises and the transaction rolls back — no half-made order can survive.
  for v_item in
    select
      (e.value ->> 'ticket_type_id')::uuid    as ticket_type_id,
      (e.value ->> 'quantity')::integer       as quantity
    from jsonb_array_elements(p_items) e
    -- Deterministic lock order. See the deadlock note above.
    order by (e.value ->> 'ticket_type_id')::uuid
  loop
    if v_item.quantity is null or v_item.quantity < 1 then
      raise exception 'Invalid quantity' using errcode = 'GN005';
    end if;

    -- THE LOCK. A concurrent order for this tier waits here.
    select * into v_type
      from public.ticket_types t
     where t.id = v_item.ticket_type_id
     for update;

    if not found then
      raise exception 'Ticket type not found'
        using errcode = 'GN004', detail = v_item.ticket_type_id::text;
    end if;

    if v_type.event_id <> p_event_id then
      raise exception 'Ticket type belongs to a different event'
        using errcode = 'GN004', detail = v_type.name;
    end if;

    if not v_type.is_active then
      raise exception 'Ticket type is not on sale'
        using errcode = 'GN004', detail = v_type.name;
    end if;

    if (v_type.sale_start is not null and v_type.sale_start > now())
       or (v_type.sale_end is not null and v_type.sale_end <= now()) then
      raise exception 'Sales are not open for this ticket type'
        using errcode = 'GN003', detail = v_type.name;
    end if;

    if v_item.quantity > v_type.max_per_order then
      raise exception 'Quantity above the limit for this ticket type'
        using errcode = 'GN002',
              detail = v_type.name || ':' || v_type.max_per_order::text;
    end if;

    -- Read availability only AFTER the lock is held.
    v_available := public.ticket_type_availability(v_type.id);

    if v_item.quantity > v_available then
      raise exception 'Not enough tickets left'
        using errcode = 'GN001',
              detail = v_type.name || ':' || greatest(v_available, 0)::text;
    end if;

    -- Price from the DATABASE, not from the caller.
    v_total := v_total + (v_type.price_kobo * v_item.quantity);
  end loop;

  -- ── Pass 2: write ────────────────────────────────────────────────────────
  -- Still inside the same transaction, still holding every lock.
  insert into public.orders (event_id, attendee_id, total_kobo, status, expires_at)
  values (
    p_event_id,
    p_attendee_id,
    v_total,
    'PENDING',
    now() + make_interval(mins => p_hold_minutes)
  )
  returning id into v_order_id;

  insert into public.order_items (order_id, ticket_type_id, quantity, unit_price_kobo, line_total_kobo)
  select
    v_order_id,
    t.id,
    i.quantity,
    t.price_kobo,
    t.price_kobo * i.quantity
  from jsonb_array_elements(p_items) e
  cross join lateral (
    select
      (e.value ->> 'ticket_type_id')::uuid as ticket_type_id,
      (e.value ->> 'quantity')::integer    as quantity
  ) i
  join public.ticket_types t on t.id = i.ticket_type_id;

  return query
    select o.id, o.reference, o.access_token, o.total_kobo
      from public.orders o
     where o.id = v_order_id;
end;
$$;


-- ── Expiring stale holds ────────────────────────────────────────────────────
-- Availability already ignores expired PENDING orders, so this job is about
-- keeping the status column honest for the admin dashboard, not about
-- correctness. Scheduled by the next migration.

create or replace function public.expire_overdue_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.orders
       set status = 'EXPIRED'
     where status = 'PENDING'
       and expires_at <= now()
    returning id
  )
  select count(*) into v_count from expired;

  if v_count > 0 then
    insert into public.audit_log (actor, action, details)
    values ('system', 'orders.expired', jsonb_build_object('count', v_count));
  end if;

  return v_count;
end;
$$;


-- ── Grants ──────────────────────────────────────────────────────────────────
-- These are SECURITY DEFINER functions, so they bypass RLS. Nobody gets to
-- call them by default; only server-side code does.
--
-- In particular the browser (anon) must NOT be able to create orders — that
-- would be the browser writing to the database, which rule 3 forbids.

revoke execute on function public.ticket_type_availability(uuid) from public, anon, authenticated;
revoke execute on function public.event_ticket_availability(uuid) from public, anon, authenticated;
revoke execute on function public.create_order_with_reservation(uuid, uuid, jsonb, integer) from public, anon, authenticated;
revoke execute on function public.expire_overdue_orders() from public, anon, authenticated;

grant execute on function public.ticket_type_availability(uuid) to service_role;
grant execute on function public.event_ticket_availability(uuid) to service_role;
grant execute on function public.create_order_with_reservation(uuid, uuid, jsonb, integer) to service_role;
grant execute on function public.expire_overdue_orders() to service_role, postgres;


comment on function public.create_order_with_reservation(uuid, uuid, jsonb, integer) is
  'Atomically checks inventory, reserves it and creates a PENDING order. Locks ticket_types rows in ascending id order so concurrent buyers cannot oversell and cannot deadlock. Prices are read from the database, never from the caller.';
