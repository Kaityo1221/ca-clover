do $$
declare
  v_jobid bigint;
begin
  for v_jobid in
    select jobid from cron.job where jobname='ca-clover-auto-sync-15m'
  loop
    perform cron.unschedule(v_jobid);
  end loop;
end
$$;

select cron.schedule(
  'ca-clover-auto-sync-15m',
  '*/15 * * * *',
  $cron$
  select net.http_post(
    url := 'https://wgiittrvgtiosogyhfcl.supabase.co/functions/v1/sync-campfire-auto',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-ca-clover-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='ca_clover_sync_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);
