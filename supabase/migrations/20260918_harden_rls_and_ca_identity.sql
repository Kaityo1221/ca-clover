create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

grant execute on function private.is_admin() to authenticated;

drop policy if exists "profiles self or admin read" on public.profiles;
create policy "profiles self or admin read"
on public.profiles for select to authenticated
using(id = (select auth.uid()) or private.is_admin());

drop policy if exists "admin reads communities" on public.communities;
drop policy if exists "ca reads assigned communities" on public.communities;
create policy "read allowed communities"
on public.communities for select to authenticated
using(
  private.is_admin()
  or exists(
    select 1 from public.community_memberships m
    where m.community_id = communities.id
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists "admin reads memberships" on public.community_memberships;
drop policy if exists "ca reads own memberships" on public.community_memberships;
create policy "read allowed memberships"
on public.community_memberships for select to authenticated
using(private.is_admin() or user_id = (select auth.uid()));

drop policy if exists "admin reads meetups" on public.meetups;
drop policy if exists "ca reads assigned meetups" on public.meetups;
create policy "read allowed meetups"
on public.meetups for select to authenticated
using(
  private.is_admin()
  or exists(
    select 1 from public.community_memberships m
    where m.community_id = meetups.community_id
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists "admin reads ca master" on public.ca_members;
create policy "admin reads ca master"
on public.ca_members for select to authenticated
using(private.is_admin());

drop policy if exists "admin reads sync runs" on public.sync_runs;
create policy "admin reads sync runs"
on public.sync_runs for select to authenticated
using(private.is_admin());

drop policy if exists "admin reads community ca links" on public.community_ca_members;
create policy "admin reads community ca links"
on public.community_ca_members for select to authenticated
using(private.is_admin());

revoke execute on function public.is_admin() from anon, authenticated, public;
drop function if exists public.is_admin();

update public.ca_members
set source_key = lower(trainer_name);

create unique index if not exists ca_members_trainer_name_ci_key
  on public.ca_members(lower(trainer_name));

create index if not exists community_ca_members_ca_member_id_idx
  on public.community_ca_members(ca_member_id);
create index if not exists community_memberships_community_id_idx
  on public.community_memberships(community_id);
create index if not exists meetups_community_id_idx
  on public.meetups(community_id);
