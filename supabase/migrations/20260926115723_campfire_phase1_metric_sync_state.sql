create table if not exists public.meetup_metric_sync_state(
  id smallint primary key default 1 check(id=1),
  next_offset integer not null default 0 check(next_offset>=0),
  last_normal_at timestamptz,
  last_hot_at timestamptz,
  updated_at timestamptz not null default now(),
  last_error text
);

insert into public.meetup_metric_sync_state(id)
values(1)
on conflict(id) do nothing;

alter table public.meetup_metric_sync_state enable row level security;

drop policy if exists "meetup metric sync state admin read" on public.meetup_metric_sync_state;
create policy "meetup metric sync state admin read"
on public.meetup_metric_sync_state
for select
to authenticated
using(private.is_admin());

revoke all on public.meetup_metric_sync_state from anon,authenticated;
grant select on public.meetup_metric_sync_state to authenticated;
