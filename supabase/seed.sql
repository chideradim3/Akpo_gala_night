-- ============================================================================
-- Gala Night — SAMPLE DATA
-- ============================================================================
-- Everything in this file is INVENTED so there is something to build against.
-- It is clearly labelled as sample (spec §14 phase 2) and is safe to delete
-- once the real event details are entered in the admin.
--
-- Safe to run more than once: it upserts on the event slug.
--
-- DO NOT RUN THIS AGAINST PRODUCTION once real tickets are on sale.
-- ============================================================================

-- Fixed ids so re-running updates the same rows instead of making new ones.
-- The 5A... prefix is a visual marker that these are seeded, not real.
do $$
declare
  v_event_id uuid := '5a000000-0000-4000-8000-000000000001';
begin

  -- ── The event ────────────────────────────────────────────────────────────
  insert into public.events (
    id, name, slug, description, date, start_time, end_time,
    venue, address, dress_code, gallery, faq,
    contact_email, contact_phone, status
  )
  values (
    v_event_id,
    'Gala Night',
    'gala-night',
    'An evening of fine dining, live music and celebration. Black tie. Limited places.',
    (current_date + interval '90 days')::date,
    '19:00',
    '23:59',
    'The Grand Ballroom',
    'Victoria Island, Lagos',
    'Black tie',
    '[]'::jsonb,
    jsonb_build_array(
      jsonb_build_object(
        'question', 'What time should I arrive?',
        'answer',   'Doors open at 7:00 PM. We recommend arriving by 7:30 PM so you are seated before the opening address.'
      ),
      jsonb_build_object(
        'question', 'Is there parking at the venue?',
        'answer',   'Yes, valet parking is available at the main entrance and is included with your ticket.'
      ),
      jsonb_build_object(
        'question', 'Can I transfer my ticket to someone else?',
        'answer',   'Yes. Tickets are not tied to a name at the door — whoever presents the QR code is admitted. Each code works once.'
      ),
      jsonb_build_object(
        'question', 'What does a VIP table include?',
        'answer',   'A reserved table seating ten guests, premium positioning near the stage, and bottle service throughout the evening.'
      )
    ),
    'hello@example.com',
    '+2348000000000',
    -- PUBLISHED so the public site has something to render. Switch the real
    -- event to DRAFT while you are still editing it.
    'PUBLISHED'
  )
  on conflict (slug) do update set
    name          = excluded.name,
    description   = excluded.description,
    date          = excluded.date,
    start_time    = excluded.start_time,
    end_time      = excluded.end_time,
    venue         = excluded.venue,
    address       = excluded.address,
    dress_code    = excluded.dress_code,
    faq           = excluded.faq,
    contact_email = excluded.contact_email,
    contact_phone = excluded.contact_phone,
    status        = excluded.status;

  -- ── Ticket tiers ─────────────────────────────────────────────────────────
  -- PRICES ARE IN KOBO. ₦200,000 is 20000000, not 200000.
  -- Deliberately small inventories so you can test "sold out" quickly.

  insert into public.ticket_types (
    id, event_id, name, description,
    price_kobo, admits, inventory, max_per_order, sort_order, is_active
  )
  values
    (
      '5a000000-0000-4000-8000-000000000101', v_event_id,
      'VIP table',
      'A reserved table for ten, premium positioning near the stage, and bottle service all evening.',
      20000000,   -- ₦200,000
      10,         -- admits ten people
      8,          -- only eight tables exist — this is the tier that can race
      2,
      1, true
    ),
    (
      '5a000000-0000-4000-8000-000000000102', v_event_id,
      'Premium single',
      'Reserved seating in the front section, welcome drink on arrival.',
      2500000,    -- ₦25,000
      1,
      60,
      6,
      2, true
    ),
    (
      '5a000000-0000-4000-8000-000000000103', v_event_id,
      'Standard',
      'General admission, open seating, full access to the evening programme.',
      500000,     -- ₦5,000
      1,
      200,
      10,
      3, true
    ),
    (
      '5a000000-0000-4000-8000-000000000104', v_event_id,
      'Early bird',
      'Sample of a tier whose sale window has closed — the checkout should show "Sales closed".',
      300000,     -- ₦3,000
      1,
      50,
      4,
      4, true
    )
  on conflict (id) do update set
    name          = excluded.name,
    description   = excluded.description,
    price_kobo    = excluded.price_kobo,
    admits        = excluded.admits,
    inventory     = excluded.inventory,
    max_per_order = excluded.max_per_order,
    sort_order    = excluded.sort_order,
    is_active     = excluded.is_active;

  -- Close the early-bird window so the "sales not open" state is testable.
  update public.ticket_types
     set sale_end = now() - interval '1 day'
   where id = '5a000000-0000-4000-8000-000000000104';

end $$;


-- ── What you should see ─────────────────────────────────────────────────────
--   4 ticket types, all available, nothing sold.
--   "Early bird" outside its sale window.
select
  t.name,
  t.price_kobo,
  (t.price_kobo / 100)                      as naira,
  t.admits,
  t.inventory,
  public.ticket_type_availability(t.id)     as available,
  t.is_active,
  (t.sale_end is not null and t.sale_end <= now()) as sale_closed
from public.ticket_types t
join public.events e on e.id = t.event_id
where e.slug = 'gala-night'
order by t.sort_order;
