do $$
declare
  v_jobid bigint;
begin
  for v_jobid in
    select jobid from cron.job
    where jobname in (
      'ca-clover-phase1-community-members-evening',
      'ca-clover-phase1-meetup-metrics-15m',
      'ca-clover-phase1-meetup-metrics-hot-5m'
    )
  loop
    perform cron.unschedule(v_jobid);
  end loop;
end
$$;

select cron.schedule(
  'ca-clover-phase1-community-members-evening',
  '0,15,30,45 11-14 * * *',
  $cron$
  select net.http_post(
    url := 'https://wgiittrvgtiosogyhfcl.supabase.co/functions/v1/sync-community-members',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-ca-clover-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='ca_clover_sync_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

select cron.schedule(
  'ca-clover-phase1-meetup-metrics-15m',
  '*/15 * * * *',
  $cron$
  select net.http_post(
    url := 'https://wgiittrvgtiosogyhfcl.supabase.co/functions/v1/sync-meetup-metrics',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-ca-clover-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='ca_clover_sync_cron_secret')
    ),
    body := '{"mode":"normal"}'::jsonb
  );
  $cron$
);

select cron.schedule(
  'ca-clover-phase1-meetup-metrics-hot-5m',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := 'https://wgiittrvgtiosogyhfcl.supabase.co/functions/v1/sync-meetup-metrics',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-ca-clover-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='ca_clover_sync_cron_secret')
    ),
    body := '{"mode":"hot"}'::jsonb
  );
  $cron$
);
