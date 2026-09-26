-- ============================================================================
-- Gala Night — 08. Landing page content columns
-- ============================================================================
-- WHY THIS MIGRATION EXISTS
--
-- The build spec asks for two things that pull in opposite directions:
--
--   §7  the landing page has About and Experience sections, and
--       "All content comes from the events table so the admin can edit it"
--   §5  lists the events columns — and has nowhere to put either of them
--
-- Hardcoding that copy in the page would satisfy §5 and break §7: the admin
-- would have to ring a developer to reword the About section. So the table
-- gains the two columns it was missing. Both are nullable, and the page hides
-- a section whose column is empty.
-- ============================================================================

alter table public.events
  add column if not exists about text,
  add column if not exists experience jsonb not null default '[]'::jsonb;

-- Shape: [{ "time": "7:00 PM", "title": "Doors open", "description": "…" }]
--
-- `time` is deliberately free text, not a time column. It is display copy on
-- a printed-programme-style list ("7:00 PM", "Midnight", "Till late"), not
-- something the system schedules anything against. It is also optional — with
-- no times the section renders as a plain list of highlights instead.
alter table public.events
  drop constraint if exists events_experience_is_array;

alter table public.events
  add constraint events_experience_is_array
  check (jsonb_typeof(experience) = 'array');

comment on column public.events.about is
  'Long-form "About" copy for the landing page. Null hides the section.';
comment on column public.events.experience is
  'The evening''s running order: [{time?, title, description?}]. Empty array hides the section.';
