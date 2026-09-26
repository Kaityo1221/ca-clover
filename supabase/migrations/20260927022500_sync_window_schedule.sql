select cron.alter_job(4, schedule => '5,20,35,50 20-23,0-12 * * *', active => true);
select cron.alter_job(7, schedule => '5,20,35,50 20-23,0-12 * * *', active => true);
select cron.alter_job(8, schedule => '5,10,15,20,25,30,35,40,45,50,55 20-23,0-12 * * *', active => true);

do $$
declare
  v_jobid bigint;
  v_command text := $cmd$
    select net.http_post(
      url := 'https://wgiittrvgtiosogyhfcl.supabase.co/functions/v1/sync-campfire-window',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-ca-clover-cron-secret',
        (select decrypted_secret from vault.decrypted_secrets where name='ca_clover_sync_cron_secret')
      ),
      body := '{"mode":"morning_priority","communityId":"f5480f20-6548-45f3-b3f7-e22aa97b67b1"}'::jsonb
    );
  $cmd$;
begin
  select jobid into v_jobid from cron.job where jobname='ca-clover-window-morning-priority' limit 1;
  if v_jobid is null then
    perform cron.schedule('ca-clover-window-morning-priority','0 20 * * *',v_command);
  else
    perform cron.alter_job(v_jobid,schedule=>'0 20 * * *',command=>v_command,active=>true);
  end if;
end $$;

do $$
declare
  v_jobid bigint;
  v_command text := $cmd$
    select net.http_post(
      url := 'https://wgiittrvgtiosogyhfcl.supabase.co/functions/v1/sync-campfire-window',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-ca-clover-cron-secret',
        (select decrypted_secret from vault.decrypted_secrets where name='ca_clover_sync_cron_secret')
      ),
      body := '{"mode":"final"}'::jsonb
    );
  $cmd$;
begin
  select jobid into v_jobid from cron.job where jobname='ca-clover-window-final-2200' limit 1;
  if v_jobid is null then
    perform cron.schedule('ca-clover-window-final-2200','0 13 * * *',v_command);
  else
    perform cron.alter_job(v_jobid,schedule=>'0 13 * * *',command=>v_command,active=>true);
  end if;
end $$;
