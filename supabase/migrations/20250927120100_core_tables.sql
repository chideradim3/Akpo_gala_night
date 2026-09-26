-- ============================================================================
-- Gala Night — 02. Core tables: events, ticket_types, attendees
-- ============================================================================

-- ── events ──────────────────────────────────────────────────────────────────
-- All landing-page content lives here so the admin can edit the site without
-- a developer. Nothing on the public site is hardcoded.

create table public.events (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(trim(name)) > 0),
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description    text,
  date           date not null,
  start_time     time,
  end_time       time,
  venue          text,
  address        text,
  dress_code     text,
  hero_image_url text,

  -- ["https://…/1.jpg", "https://…/2.jpg"]
  gallery        jsonb not null default '[]'::jsonb
                 check (jsonb_typeof(gallery) = 'array'),

  -- [{"question": "…", "answer": "…"}]
  faq            jsonb not null default '[]'::jsonb
                 check (jsonb_typeof(faq) = 'array'),

  contact_email  text,
  contact_phone  text,
  status         public.event_status not null default 'DRAFT',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- The public site looks up "the one published event" on every page load.
create index events_status_idx on public.events (status) where status = 'PUBLISHED';


-- ── ticket_types ────────────────────────────────────────────────────────────
-- NOTE: deliberately NO sold_count column (spec §5).
--
-- A counter would be a second source of truth that can drift out of step with
-- reality — a failed payment, a refund or a crashed request leaves it wrong,
-- and the error is silent. Availability is always DERIVED from orders instead.
-- See ticket_type_availability() in the inventory migration.

create table public.ticket_types (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events (id) on delete cascade,
  name           text not null check (length(trim(name)) > 0),
  description    text,

  -- INTEGER KOBO. ₦200,000 is 20000000.
  price_kobo     integer not null check (price_kobo >= 0),

  -- How many people one ticket lets in. A VIP table may admit 10.
  admits         integer not null default 1 check (admits >= 1),

  -- Total ever available, NOT the remaining count.
  inventory      integer not null check (inventory >= 0),

  max_per_order  integer not null default 10 check (max_per_order >= 1),
  sale_start     timestamptz,
  sale_end       timestamptz,
  is_active      boolean not null default true,
  image_url      text,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint ticket_types_sale_window_valid
    check (sale_start is null or sale_end is null or sale_end > sale_start)
);

create trigger ticket_types_set_updated_at
  before update on public.ticket_types
  for each row execute function public.set_updated_at();

create index ticket_types_event_idx on public.ticket_types (event_id, sort_order);


-- ── attendees ───────────────────────────────────────────────────────────────
-- One row per person, keyed on email. A returning buyer reuses their row and
-- we refresh their name and phone (spec §5).

create table public.attendees (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique
              -- Stored lower-cased so "Ada@Gmail.com" and "ada@gmail.com" are
              -- the same person. The constraint makes that impossible to get
              -- wrong from any code path, including manual SQL.
              check (email = lower(email) and email like '%_@_%'),
  first_name  text not null check (length(trim(first_name)) > 0),
  last_name   text not null check (length(trim(last_name)) > 0),

  -- Normalised to +234XXXXXXXXXX before it reaches the database. The app
  -- accepts 08012345678 too and converts it (spec §7 step 1).
  phone       text not null check (phone ~ '^\+234[0-9]{10}$'),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger attendees_set_updated_at
  before update on public.attendees
  for each row execute function public.set_updated_at();


comment on column public.ticket_types.inventory is
  'Total ever available, not the remaining count. Remaining = inventory minus PAID and unexpired PENDING quantities — see ticket_type_availability().';
comment on column public.ticket_types.price_kobo is
  'Integer kobo. Never a decimal. ₦200,000 = 20000000.';
comment on column public.attendees.phone is
  'Always +234XXXXXXXXXX. The app normalises 08012345678 before insert.';
