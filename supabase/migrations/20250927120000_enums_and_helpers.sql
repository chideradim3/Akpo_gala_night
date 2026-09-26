-- ============================================================================
-- Gala Night — 01. Enums, extensions and shared helpers
-- ============================================================================
-- Run order matters. Every later migration depends on what is defined here.
--
-- MONEY RULE: every money column in this schema is `integer` kobo.
-- ₦5,000 is 500000. There is no numeric, no decimal and no float anywhere.
-- ============================================================================

-- pgcrypto gives us gen_random_uuid() and gen_random_bytes() for secrets.
create extension if not exists pgcrypto with schema extensions;

-- ── Status enums ────────────────────────────────────────────────────────────
-- Enums rather than text columns so an impossible status cannot be written,
-- even by a direct SQL statement or a future script.

-- PENDING → PAID | FAILED | EXPIRED | CANCELLED,  PAID → REFUNDED
create type public.order_status as enum (
  'PENDING',
  'PAID',
  'FAILED',
  'EXPIRED',
  'CANCELLED',
  'REFUNDED'
);

-- ACTIVE → USED (check-in),  ACTIVE → CANCELLED (refund)
create type public.ticket_status as enum (
  'ACTIVE',
  'USED',
  'CANCELLED'
);

create type public.event_status as enum (
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED'
);

-- owner: can edit settings, prices and export.  staff: view only (and will
-- use the check-in page once the payment developer builds it).
create type public.admin_role as enum (
  'owner',
  'staff'
);


-- ── updated_at trigger ──────────────────────────────────────────────────────
-- Applied to every table that has an updated_at column, so the timestamp is
-- maintained by the database and cannot be forgotten by application code.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ── Human-readable order references: GALA-1042 ──────────────────────────────
-- A sequence, not a random number: references must be unique, short, and
-- readable down a phone line when a guest calls about their order.

create sequence if not exists public.order_reference_seq start with 1000 increment by 1;

create or replace function public.generate_order_reference()
returns text
language sql
volatile
as $$
  select 'GALA-' || nextval('public.order_reference_seq')::text;
$$;


-- ── Opaque secrets ──────────────────────────────────────────────────────────
-- Used for orders.access_token (the secret in the buyer's ticket URL) and
-- tickets.qr_token (the only thing a QR code contains).
--
-- 32 bytes of CSPRNG output, base64url encoded. Long enough that guessing one
-- is not a realistic attack, and URL-safe so it can sit in a path segment.

create or replace function public.generate_secret_token()
returns text
language sql
volatile
as $$
  select replace(replace(encode(extensions.gen_random_bytes(32), 'base64'), '+', '-'), '/', '_');
$$;


-- ── Human-readable ticket codes: K7Q2-XM9P ──────────────────────────────────
-- Read aloud at the door and typed in by hand when a scan fails, so the
-- alphabet deliberately EXCLUDES characters people confuse:
--   0 vs O,  1 vs I vs L,  5 vs S,  8 vs B,  2 vs Z
-- That leaves 26 symbols. Two groups of four is 26^8 ≈ 2.1 x 10^11
-- combinations — collisions are handled by a unique index and a retry anyway.

create or replace function public.generate_ticket_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := '346789ACDEFGHJKMNPQRTUVWXY';
  result text := '';
  i integer;
begin
  for i in 1..8 loop
    if i = 5 then
      result := result || '-';
    end if;
    -- floor(random() * 26) + 1 : 1-based index into the alphabet
    result := result || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
  end loop;
  return result;
end;
$$;


comment on function public.generate_ticket_code() is
  'Short human-readable ticket code, e.g. K7Q2-XM9P. Alphabet excludes 0/O, 1/I/L, 5/S, 8/B, 2/Z so it can be read aloud and typed at the door.';
