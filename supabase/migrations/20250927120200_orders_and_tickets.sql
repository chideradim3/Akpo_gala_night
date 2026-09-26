-- ============================================================================
-- Gala Night — 03. orders, order_items, tickets
-- ============================================================================

-- ── orders ──────────────────────────────────────────────────────────────────

create table public.orders (
  id                uuid primary key default gen_random_uuid(),

  -- Short and readable: GALA-1042. Quoted by guests over the phone.
  reference         text not null unique default public.generate_order_reference(),

  -- The secret in /tickets/<access_token>. Anyone holding it can see the
  -- tickets, which is why the page is noindex and the token is 32 random
  -- bytes rather than the order id.
  access_token      text not null unique default public.generate_secret_token(),

  event_id          uuid not null references public.events (id),
  attendee_id       uuid not null references public.attendees (id),

  -- INTEGER KOBO, always recomputed on the server from ticket_types prices.
  -- Never taken from the browser (non-negotiable rule 2).
  total_kobo        integer not null check (total_kobo >= 0),

  status            public.order_status not null default 'PENDING',

  -- now() + 30 minutes at creation. A PENDING order holds inventory until
  -- this passes; after that the seats are free again.
  expires_at        timestamptz not null,

  paid_at           timestamptz,

  -- Set ONLY by confirmOrderPayment(). Unique, which is what makes the
  -- payment confirmation idempotent: a retried webhook cannot pay twice.
  payment_reference text unique,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- A PAID order must record when, and only a PAID/REFUNDED order may.
  constraint orders_paid_at_consistent check (
    (status in ('PAID', 'REFUNDED') and paid_at is not null)
    or (status not in ('PAID', 'REFUNDED') and paid_at is null)
  )
);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create index orders_attendee_idx on public.orders (attendee_id);
create index orders_event_status_idx on public.orders (event_id, status);

-- Used by the pg_cron sweeper to find overdue PENDING orders cheaply.
create index orders_pending_expiry_idx on public.orders (expires_at)
  where status = 'PENDING';


-- ── order_items ─────────────────────────────────────────────────────────────
-- One row per ticket TYPE in the order (quantity 3 = one row), not one per
-- ticket. Individual tickets are created later, only once the order is PAID.

create table public.order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders (id) on delete cascade,
  ticket_type_id  uuid not null references public.ticket_types (id),
  quantity        integer not null check (quantity > 0),

  -- Copied from ticket_types AT PURCHASE TIME. If the admin changes the price
  -- tomorrow, this order still shows what the buyer actually agreed to pay.
  unit_price_kobo integer not null check (unit_price_kobo >= 0),
  line_total_kobo integer not null check (line_total_kobo >= 0),

  -- The database itself checks the arithmetic. A bug in application code
  -- cannot write a line total that does not match price × quantity.
  constraint order_items_line_total_correct
    check (line_total_kobo = unit_price_kobo * quantity),

  -- One line per tier per order — two "VIP table" rows would double-count.
  constraint order_items_unique_type_per_order unique (order_id, ticket_type_id)
);

create index order_items_ticket_type_idx on public.order_items (ticket_type_id);


-- ── tickets ─────────────────────────────────────────────────────────────────
-- One row per admitted unit. A VIP table with quantity 2 produces 2 tickets,
-- each admitting 10 people.
--
-- Tickets exist ONLY for PAID orders (spec §6). Nothing creates them except
-- issueTickets(), called from the payment confirmation.

create table public.tickets (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,
  order_item_id  uuid not null references public.order_items (id) on delete cascade,
  ticket_type_id uuid not null references public.ticket_types (id),
  attendee_id    uuid not null references public.attendees (id),

  -- Read aloud and typed at the door. See generate_ticket_code().
  ticket_code    text not null unique default public.generate_ticket_code(),

  -- THE ONLY THING THE QR CODE CONTAINS. No name, no email, no order id —
  -- so a photographed ticket leaks nothing about the guest.
  qr_token       text not null unique default public.generate_secret_token(),

  status         public.ticket_status not null default 'ACTIVE',

  -- Written by the payment developer's check-in page, not by us.
  -- See CHECK_IN_INTEGRATION.md.
  checked_in_at  timestamptz,
  checked_in_by  uuid references auth.users (id),

  created_at     timestamptz not null default now(),

  constraint tickets_checked_in_consistent check (
    (status = 'USED' and checked_in_at is not null)
    or (status <> 'USED' and checked_in_at is null)
  )
);

create index tickets_order_idx on public.tickets (order_id);
create index tickets_attendee_idx on public.tickets (attendee_id);
create index tickets_type_status_idx on public.tickets (ticket_type_id, status);

-- The check-in page looks a ticket up by EITHER the scanned token or the
-- typed code. Both are already unique, so both lookups are index hits.


comment on column public.orders.payment_reference is
  'Set only by confirmOrderPayment(). The unique constraint is what makes payment confirmation idempotent — a replayed webhook cannot pay the same order twice.';
comment on column public.tickets.qr_token is
  'The ONLY value encoded in the QR code. Opaque and random — it carries no personal data.';
comment on column public.orders.access_token is
  'Secret in the buyer ticket URL /tickets/<token>. Anyone with the link can view the tickets, so the page is noindex.';
