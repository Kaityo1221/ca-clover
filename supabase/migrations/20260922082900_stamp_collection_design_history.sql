alter table public.stamp_collections
  add column if not exists acquisition_icon_version_id uuid
    references public.community_icon_versions(id) on delete set null;

create table public.stamp_collection_designs(
  collection_id uuid not null
    references public.stamp_collections(id) on delete cascade,
  icon_version_id uuid not null
    references public.community_icon_versions(id) on delete restrict,
  grant_source text not null default 'acquisition'
    check (grant_source in ('acquisition','acquisition_backfill','auto_new_design','admin','import')),
  granted_at timestamptz not null default now(),
  primary key(collection_id,icon_version_id)
);

create index stamp_collection_designs_icon_version_idx
  on public.stamp_collection_designs(icon_version_id);

alter table public.stamp_collection_designs enable row level security;

create policy "stamp collection designs owner or admin read"
on public.stamp_collection_designs
for select
to authenticated
using(
  private.is_admin()
  or exists(
    select 1
    from public.stamp_collections sc
    where sc.id=stamp_collection_designs.collection_id
      and sc.owner_user_id=(select auth.uid())
  )
);

revoke all on public.stamp_collection_designs from anon,authenticated;
grant select on public.stamp_collection_designs to authenticated;

create table public.stamp_collection_preferences(
  collection_id uuid primary key
    references public.stamp_collections(id) on delete cascade,
  icon_version_id uuid not null,
  updated_at timestamptz not null default now(),
  foreign key(collection_id,icon_version_id)
    references public.stamp_collection_designs(collection_id,icon_version_id)
    on delete cascade
);

alter table public.stamp_collection_preferences enable row level security;

create policy "stamp preference owner read"
on public.stamp_collection_preferences
for select
to authenticated
using(
  exists(
    select 1
    from public.stamp_collections sc
    where sc.id=stamp_collection_preferences.collection_id
      and sc.owner_user_id=(select auth.uid())
  )
);

create policy "stamp preference owner insert"
on public.stamp_collection_preferences
for insert
to authenticated
with check(
  exists(
    select 1
    from public.stamp_collections sc
    where sc.id=stamp_collection_preferences.collection_id
      and sc.owner_user_id=(select auth.uid())
  )
);

create policy "stamp preference owner update"
on public.stamp_collection_preferences
for update
to authenticated
using(
  exists(
    select 1
    from public.stamp_collections sc
    where sc.id=stamp_collection_preferences.collection_id
      and sc.owner_user_id=(select auth.uid())
  )
)
with check(
  exists(
    select 1
    from public.stamp_collections sc
    where sc.id=stamp_collection_preferences.collection_id
      and sc.owner_user_id=(select auth.uid())
  )
);

create policy "stamp preference owner delete"
on public.stamp_collection_preferences
for delete
to authenticated
using(
  exists(
    select 1
    from public.stamp_collections sc
    where sc.id=stamp_collection_preferences.collection_id
      and sc.owner_user_id=(select auth.uid())
  )
);

revoke all on public.stamp_collection_preferences from anon,authenticated;
grant select,insert,update,delete on public.stamp_collection_preferences to authenticated;

create policy "entitled stamp owners read icon versions"
on public.community_icon_versions
for select
to authenticated
using(
  private.is_admin()
  or exists(
    select 1
    from public.stamp_collection_designs scd
    join public.stamp_collections sc on sc.id=scd.collection_id
    where scd.icon_version_id=community_icon_versions.id
      and sc.owner_user_id=(select auth.uid())
  )
);

create or replace function private.stamp_prepare_collection_design()
returns trigger
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_version_id uuid;
begin
  if new.acquisition_icon_version_id is null then
    select civ.id
      into v_version_id
    from public.community_icon_versions civ
    where civ.community_id=new.community_id
      and civ.is_current
    order by civ.last_seen_at desc,civ.first_seen_at desc
    limit 1;

    new.acquisition_icon_version_id:=v_version_id;
  end if;

  return new;
end;
$$;

drop trigger if exists stamp_prepare_collection_design on public.stamp_collections;
create trigger stamp_prepare_collection_design
before insert on public.stamp_collections
for each row
execute function private.stamp_prepare_collection_design();

create or replace function private.stamp_grant_acquisition_design()
returns trigger
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
begin
  if new.acquisition_icon_version_id is not null then
    insert into public.stamp_collection_designs(
      collection_id,icon_version_id,grant_source,granted_at
    )
    values(
      new.id,new.acquisition_icon_version_id,'acquisition',new.first_acquired_at
    )
    on conflict(collection_id,icon_version_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_grant_acquisition_design on public.stamp_collections;
create trigger stamp_grant_acquisition_design
after insert on public.stamp_collections
for each row
execute function private.stamp_grant_acquisition_design();

create or replace function private.stamp_grant_new_community_design()
returns trigger
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
begin
  if new.is_current
     and (
       tg_op='INSERT'
       or old.is_current is distinct from new.is_current
     ) then

    insert into public.stamp_collection_designs(
      collection_id,icon_version_id,grant_source,granted_at
    )
    select
      sc.id,
      new.id,
      case
        when sc.acquisition_icon_version_id is null
          then 'acquisition_backfill'
        else 'auto_new_design'
      end,
      greatest(sc.first_acquired_at,new.first_seen_at)
    from public.stamp_collections sc
    where sc.community_id=new.community_id
    on conflict(collection_id,icon_version_id) do nothing;

    update public.stamp_collections sc
    set acquisition_icon_version_id=new.id
    where sc.community_id=new.community_id
      and sc.acquisition_icon_version_id is null;
  end if;

  return new;
end;
$$;

drop trigger if exists stamp_grant_new_community_design on public.community_icon_versions;
create trigger stamp_grant_new_community_design
after insert or update of is_current on public.community_icon_versions
for each row
execute function private.stamp_grant_new_community_design();

update public.stamp_collections sc
set acquisition_icon_version_id=(
  select v.id
  from public.community_icon_versions v
  where v.community_id=sc.community_id
    and v.is_current
  order by v.last_seen_at desc,v.first_seen_at desc
  limit 1
)
where sc.acquisition_icon_version_id is null
  and exists(
    select 1
    from public.community_icon_versions v
    where v.community_id=sc.community_id
      and v.is_current
  );

insert into public.stamp_collection_designs(
  collection_id,icon_version_id,grant_source,granted_at
)
select
  sc.id,
  sc.acquisition_icon_version_id,
  'acquisition_backfill',
  sc.first_acquired_at
from public.stamp_collections sc
where sc.acquisition_icon_version_id is not null
on conflict(collection_id,icon_version_id) do nothing;

comment on column public.stamp_collections.acquisition_icon_version_id is
  'Community icon version that was current when this CA stamp was first acquired.';
comment on table public.stamp_collection_designs is
  'Community designs owned by a collected CA stamp. New Community designs are auto-granted to existing owners without creating a reunion.';
comment on table public.stamp_collection_preferences is
  'Optional pinned Community design for one collected CA stamp. No row means use the newest owned design.';
