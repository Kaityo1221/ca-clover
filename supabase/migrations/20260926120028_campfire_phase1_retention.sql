do $$
declare
  v_jobid bigint;
begin
  for v_jobid in select jobid from cron.job where jobname='ca-clover-phase1-metric-retention'
  loop
    perform cron.unschedule(v_jobid);
  end loop;
end
$$;

select cron.schedule(
  'ca-clover-phase1-metric-retention',
  '45 10 * * *',
  $cron$
    delete from public.meetup_metric_snapshots
    where observed_at < now() - interval '1 year';
  $cron$
);
