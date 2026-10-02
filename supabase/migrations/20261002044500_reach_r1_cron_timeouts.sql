select cron.schedule(
  'ca-clover-reach-discovery-night-15m',
  '5,20,35,50 13-19 * * *',
  $$
  select net.http_post(
    url := 'https://wgiittrvgtiosogyhfcl.supabase.co/functions/v1/sync-reach-discovery',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-ca-clover-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='ca_clover_sync_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

select cron.schedule(
  'ca-clover-reaction-metrics-15m',
  '12,27,42,57 * * * *',
  $$
  select net.http_post(
    url := 'https://wgiittrvgtiosogyhfcl.supabase.co/functions/v1/sync-meetup-metrics',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-ca-clover-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='ca_clover_sync_cron_secret')
    ),
    body := '{"mode":"reaction"}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);
