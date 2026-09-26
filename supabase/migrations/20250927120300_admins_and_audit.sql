-- ============================================================================
-- Gala Night — 04. admins, audit_log
-- ============================================================================

-- ── admins ──────────────────────────────────────────────────────────────────
-- There is NO public admin sign-up (spec §5). A person becomes an admin only
-- when someone adds a row here by hand in the Supabase dashboard.
--
-- Being able to log in to Supabase Auth is NOT enough to reach /admin. The
-- requireAdmin() helper checks for a row in this table on the server, on
-- every admin route and every admin action.

create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       public.admin_role not null default 'staff',
  created_at timestamptz not null default now()
);


-- ── audit_log ───────────────────────────────────────────────────────────────
-- Insert-only history of everything that matters. Nothing updates or deletes
-- from this table — that is enforced by RLS in the next migration and by the
-- absence of any service function that would.
--
-- Recorded: order paid, tickets issued, ticket type changes, event setting
-- changes, CSV exports, and check-ins once the payment developer's page
-- exists.

create table public.audit_log (
  id         bigint generated always as identity primary key,

  -- An admin's auth.users id as text, or the literal 'system' / 'payment'.
  -- Text rather than a foreign key because two of the three actors are not
  -- users, and because an audit trail must survive the user being deleted.
  actor      text not null check (length(trim(actor)) > 0),

  -- Verb-ish and stable, e.g. 'order.paid', 'tickets.issued',
  -- 'ticket_type.updated', 'attendees.exported', 'ticket.checked_in'.
  action     text not null check (length(trim(action)) > 0),

  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_action_idx on public.audit_log (action, created_at desc);


comment on table public.audit_log is
  'Insert-only. No code path updates or deletes rows here; RLS blocks it too.';
comment on column public.audit_log.actor is
  'An admin auth.users id as text, or the literal string "system" or "payment".';
