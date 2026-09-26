-- ============================================================================
-- Gala Night — 07. Scheduled jobs (pg_cron)
-- ============================================================================
-- Marks overdue PENDING orders as EXPIRED, once a minute.
--
-- WORTH UNDERSTANDING: this job is NOT what frees up inventory. Availability
-- is calculated live and already ignores any PENDING order whose expires_at
-- has passed, so a held seat is released the instant the clock ticks past it,
-- with or without this job. What the job does is keep the `status` column
-- truthful, so the admin dashboard does not show a pile of "pending" orders
-- that expired days ago.
--
-- That distinction matters: if pg_cron is unavailable, the site still sells
-- tickets correctly. Only the admin view gets untidy. So this whole migration
-- is written to degrade quietly rather than fail the deployment.
-- ============================================================================

do $$
begin
  -- pg_cron is NOT relocatable: it always creates and lives in the `cron`
  -- schema, so no `with schema` clause here.
  create extension if not exists pg_cron;

  -- Re-running this migration must not stack up duplicate jobs.
  if exists (select 1 from cron.job where jobname = 'gala-expire-pending-orders') then
    perform cron.unschedule('gala-expire-pending-orders');
  end if;

  perform cron.schedule(
    'gala-expire-pending-orders',
    '* * * * *',                                   -- every minute
    $job$ select public.expire_overdue_orders(); $job$
  );

  raise notice 'Scheduled gala-expire-pending-orders (every minute).';

exception
  when undefined_file
    or undefined_table
    or undefined_function
    or undefined_object
    or insufficient_privilege
    or feature_not_supported
  then
    -- pg_cron not installed, not permitted, or unavailable on this plan.
    -- Not fatal — see the note at the top of this file.
    raise notice
      'pg_cron unavailable (%), skipping the order-expiry schedule. Ticket sales are unaffected. To enable it: Supabase dashboard -> Database -> Extensions -> pg_cron, then re-run this migration.',
      sqlerrm;
end;
$$;
