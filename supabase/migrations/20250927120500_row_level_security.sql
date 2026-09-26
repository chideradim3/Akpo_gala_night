-- ============================================================================
-- Gala Night — 06. Row Level Security
-- ============================================================================
-- HOW TO READ THIS FILE
--
-- RLS is default-deny. Once `enable row level security` is on a table, NO
-- role can read or write it unless a policy explicitly allows that action.
-- So the security of this schema comes as much from the policies that are
-- ABSENT as from the ones written here.
--
-- The roles:
--   anon          the browser, using the public NEXT_PUBLIC_ anon key
--   authenticated a signed-in Supabase Auth user (admins, from Phase 7)
--   service_role  our server code. BYPASSES RLS ENTIRELY by design.
--
-- The whole policy set is one sentence: the browser may read the published
-- event and its active ticket types, and nothing else in the database.
-- Everything else goes through server code (non-negotiable rules 2 and 3).
-- ============================================================================

alter table public.events       enable row level security;
alter table public.ticket_types enable row level security;
alter table public.attendees    enable row level security;
alter table public.orders       enable row level security;
alter table public.order_items  enable row level security;
alter table public.tickets      enable row level security;
alter table public.admins       enable row level security;
alter table public.audit_log    enable row level security;

-- Belt and braces: even if a policy were added by mistake later, the anon
-- role has no table-level write grant to fall back on.
revoke all on public.attendees, public.orders, public.order_items,
              public.tickets, public.admins, public.audit_log
  from anon, authenticated;


-- ── events: the public may read the published event ─────────────────────────
-- DRAFT and ARCHIVED events stay invisible, so the admin can prepare next
-- year's gala on the live site without anyone seeing it.

create policy "Anyone can read the published event"
  on public.events
  for select
  to anon, authenticated
  using (status = 'PUBLISHED');


-- ── ticket_types: the public may read active tiers of a published event ─────
-- Prices and descriptions are public information — they are on the page.
-- `inventory` is readable too, but that is only the TOTAL; how many are left
-- is never exposed, because working that out needs the orders table, which
-- anon cannot read at all.

create policy "Anyone can read active ticket types of the published event"
  on public.ticket_types
  for select
  to anon, authenticated
  using (
    is_active
    and exists (
      select 1
        from public.events e
       where e.id = ticket_types.event_id
         and e.status = 'PUBLISHED'
    )
  );


-- ── attendees, orders, order_items, tickets ─────────────────────────────────
--
-- NO POLICIES. This is deliberate and is the most important part of the file.
--
-- With RLS on and no policy, anon and authenticated get nothing: they cannot
-- read one row, cannot insert, cannot update, cannot delete. Every legitimate
-- use — creating an order, showing a buyer their tickets, the admin order
-- list — runs in server code through the service role.
--
-- This is why a guessed order id, a scraped email address or a crafted
-- request from the browser cannot reach anyone's personal data or tickets.
--
-- In particular: the buyer's own ticket page does NOT work by letting the
-- browser query its own order. The server reads it, having first checked the
-- access_token, and sends back only the rendered result.


-- ── admins ──────────────────────────────────────────────────────────────────
-- Also no anon/authenticated policy. requireAdmin() checks this table with
-- the service role on the server.
--
-- Not letting a signed-in user read even their OWN admins row is intentional:
-- the browser never needs to know, and if it never knows, no client-side
-- check can be tampered with into granting access. The server decides.


-- ── audit_log: insert-only, and not even that from the browser ──────────────
-- No policies at all. Server code writes it through the service role. There
-- is deliberately no update or delete path anywhere in the application, so
-- the trail cannot be rewritten after the fact.


-- ── Storage: ticket type and gallery images ─────────────────────────────────
-- A public read-only bucket. Images are on the public site anyway, and
-- uploads happen in the admin through server code (Phase 8).

insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;

-- Dropped first so this file can be re-run safely. Storage policies are
-- shared across the whole project, so a name collision with something added
-- through the dashboard is possible.
drop policy if exists "Anyone can view event images" on storage.objects;

create policy "Anyone can view event images"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'event-images');

-- No insert/update/delete policy: uploads go through the service role.
