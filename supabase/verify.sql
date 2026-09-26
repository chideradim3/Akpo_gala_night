-- ============================================================================
-- Gala Night — verify the database is set up correctly
-- ============================================================================
-- Read-only. Changes nothing. Run it after applying the migrations and seed.
--
--   npx supabase db reset            (local)
--   or paste this into the Supabase dashboard SQL editor
--
-- Every check below prints PASS or FAIL. All eight should say PASS.
-- ============================================================================

\echo '=== 1. Tables exist ==='
select
  case when count(*) = 8 then 'PASS' else 'FAIL' end as result,
  count(*) || ' of 8 tables' as detail,
  string_agg(tablename, ', ' order by tablename) as tables
from pg_tables
where schemaname = 'public'
  and tablename in ('events','ticket_types','attendees','orders',
                    'order_items','tickets','admins','audit_log');


\echo '=== 2. Row Level Security is ON for every table ==='
select
  case when count(*) filter (where not rowsecurity) = 0 then 'PASS' else 'FAIL' end as result,
  coalesce(string_agg(tablename, ', ') filter (where not rowsecurity), 'all protected') as unprotected
from pg_tables
where schemaname = 'public'
  and tablename in ('events','ticket_types','attendees','orders',
                    'order_items','tickets','admins','audit_log');


\echo '=== 3. Only events and ticket_types are readable by the public ==='
-- Any other table appearing here would be a data leak.
select
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result,
  coalesce(string_agg(distinct tablename, ', '), 'none') as unexpectedly_public
from pg_policies
where schemaname = 'public'
  and ('anon' = any(roles))
  and tablename not in ('events','ticket_types');


\echo '=== 4. Money columns are integers, never decimals ==='
select
  case when count(*) filter (where data_type <> 'integer') = 0 then 'PASS' else 'FAIL' end as result,
  coalesce(string_agg(table_name || '.' || column_name || ' is ' || data_type, ', ')
           filter (where data_type <> 'integer'), 'all integer') as detail
from information_schema.columns
where table_schema = 'public' and column_name like '%_kobo';


\echo '=== 5. Functions exist ==='
select
  case when count(*) = 4 then 'PASS' else 'FAIL' end as result,
  string_agg(proname, ', ' order by proname) as functions
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in ('create_order_with_reservation','ticket_type_availability',
                  'event_ticket_availability','expire_overdue_orders');


\echo '=== 6. Order creation is NOT callable by the browser ==='
-- anon holding EXECUTE here would mean the browser could write orders,
-- which non-negotiable rule 3 forbids.
select
  case when not has_function_privilege('anon',
         'public.create_order_with_reservation(uuid,uuid,jsonb,integer)', 'EXECUTE')
       then 'PASS' else 'FAIL — anon can create orders' end as result;


\echo '=== 7. Sample data loaded, with availability derived correctly ==='
select
  t.name,
  t.price_kobo,
  '₦' || to_char(t.price_kobo / 100, 'FM999,999,999') as price,
  t.admits,
  t.inventory,
  public.ticket_type_availability(t.id) as available,
  case when public.ticket_type_availability(t.id) = t.inventory
       then 'PASS' else 'FAIL' end as result
from public.ticket_types t
join public.events e on e.id = t.event_id
where e.slug = 'gala-night'
order by t.sort_order;


\echo '=== 8. Expiry sweeper is scheduled (optional — needs pg_cron) ==='
select
  case
    when not exists (select 1 from pg_extension where extname = 'pg_cron')
      then 'SKIPPED — pg_cron not enabled. Ticket sales are unaffected; only the admin status column goes stale.'
    when exists (select 1 from cron.job where jobname = 'gala-expire-pending-orders')
      then 'PASS'
    else 'FAIL — pg_cron is on but the job is missing'
  end as result;
