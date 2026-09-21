create table public.user_ca_identities(
  user_id uuid not null references public.profiles(id) on delete cascade,
  ca_member_id uuid not null,
  community_id uuid not null,
  is_primary boolean not null default false,
  verification_source text not null default 'admin',
  verified_at timestamptz not null default now(),
  verified_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(user_id, ca_member_id, community_id),
  unique(ca_member_id, community_id),
  foreign key(community_id, ca_member_id)
    references public.community_ca_members(community_id, ca_member_id)
    on delete cascade
);

create unique index user_ca_identities_one_primary_per_user_uq
  on public.user_ca_identities(user_id)
  where is_primary;

alter table public.user_ca_identities enable row level security;

create policy "ca identity self or admin read"
on public.user_ca_identities
for select
to authenticated
using(user_id=(select auth.uid()) or private.is_admin());

revoke all on public.user_ca_identities from anon, authenticated;
grant select on public.user_ca_identities to authenticated;

comment on table public.user_ca_identities is
  'Explicit link between a CA Clover account and the CA stamp identity it represents. One primary identity is used for exchanges.';

insert into public.user_ca_identities(
  user_id,ca_member_id,community_id,is_primary,verification_source,verified_at
)
select distinct on (p.id)
  p.id,
  m.id,
  cm.community_id,
  true,
  'backfill_exact_niantic_id',
  now()
from public.profiles p
join public.community_memberships cm
  on cm.user_id=p.id
join public.community_ca_members l
  on l.community_id=cm.community_id
join public.ca_members m
  on m.id=l.ca_member_id
where p.role='ca'
  and m.status='active'
  and lower(m.source_key)=lower(trim(leading '@' from coalesce(p.niantic_id,'')))
order by p.id, case when m.ca_level='1st' then 0 else 1 end, m.trainer_name
on conflict do nothing;

with candidates as (
  select
    p.id as user_id,
    min(m.id::text)::uuid as ca_member_id,
    min(cm.community_id::text)::uuid as community_id,
    count(distinct (m.id::text || ':' || cm.community_id::text)) as candidate_count
  from public.profiles p
  join public.community_memberships cm
    on cm.user_id=p.id
  join public.community_ca_members l
    on l.community_id=cm.community_id
  join public.ca_members m
    on m.id=l.ca_member_id
  where p.role='ca'
    and m.status='active'
    and not exists(
      select 1
      from public.user_ca_identities i
      where i.user_id=p.id
    )
  group by p.id
)
insert into public.user_ca_identities(
  user_id,ca_member_id,community_id,is_primary,verification_source,verified_at
)
select user_id,ca_member_id,community_id,true,'backfill_unique_assigned_ca',now()
from candidates
where candidate_count=1
on conflict do nothing;

create table public.stamp_exchange_transactions(
  exchange_key uuid primary key,
  user_a_id uuid not null references public.profiles(id) on delete restrict,
  user_b_id uuid not null references public.profiles(id) on delete restrict,
  source text not null
    check (source in ('normal','event','bulk','admin','import')),
  location text,
  event_name text,
  timezone text not null,
  local_date date not null,
  status text not null default 'processing'
    check (status in ('processing','completed')),
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (user_a_id<>user_b_id)
);

create index stamp_exchange_transactions_user_a_idx
  on public.stamp_exchange_transactions(user_a_id,created_at desc);
create index stamp_exchange_transactions_user_b_idx
  on public.stamp_exchange_transactions(user_b_id,created_at desc);

alter table public.stamp_exchange_transactions enable row level security;

create policy "exchange transactions participant or admin read"
on public.stamp_exchange_transactions
for select
to authenticated
using(
  user_a_id=(select auth.uid())
  or user_b_id=(select auth.uid())
  or private.is_admin()
);

revoke all on public.stamp_exchange_transactions from anon, authenticated;
grant select on public.stamp_exchange_transactions to authenticated;

create unique index stamp_reunions_one_per_local_day_uq
  on public.stamp_reunions(collection_id,local_date)
  where local_date is not null;

create or replace function public.stamp_exchange_pair_internal(
  p_exchange_key uuid,
  p_caller_user_id uuid,
  p_partner_user_id uuid,
  p_source text default 'normal',
  p_location text default null,
  p_event_name text default null,
  p_timezone text default 'Asia/Tokyo'
)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_now timestamptz := now();
  v_local_date date;
  v_user_a uuid;
  v_user_b uuid;
  v_existing public.stamp_exchange_transactions%rowtype;

  v_caller_ca uuid;
  v_caller_community uuid;
  v_caller_level text;
  v_caller_status text;

  v_partner_ca uuid;
  v_partner_community uuid;
  v_partner_level text;
  v_partner_status text;

  v_collection_caller uuid;
  v_collection_partner uuid;
  v_reunion_caller uuid;
  v_reunion_partner uuid;
  v_status_caller text;
  v_status_partner text;
  v_result jsonb;
  v_inserted_key uuid;
begin
  if p_exchange_key is null or p_caller_user_id is null or p_partner_user_id is null then
    raise exception 'exchange key and both users are required' using errcode='22023';
  end if;
  if p_caller_user_id=p_partner_user_id then
    raise exception 'self exchange is not allowed' using errcode='22023';
  end if;
  if p_source not in ('normal','event','bulk','admin','import') then
    raise exception 'invalid exchange source' using errcode='22023';
  end if;
  if not exists(select 1 from pg_timezone_names where name=p_timezone) then
    raise exception 'invalid timezone' using errcode='22023';
  end if;

  v_local_date := (v_now at time zone p_timezone)::date;

  if p_caller_user_id::text < p_partner_user_id::text then
    v_user_a:=p_caller_user_id;
    v_user_b:=p_partner_user_id;
  else
    v_user_a:=p_partner_user_id;
    v_user_b:=p_caller_user_id;
  end if;

  if not exists(
    select 1 from public.profiles p
    where p.id=p_caller_user_id
      and (p.role='admin' or exists(
        select 1 from public.user_permissions up
        where up.user_id=p.id and up.permission_code='S'
      ))
  ) then
    raise exception 'caller does not have Stamp Rally access' using errcode='42501';
  end if;

  if not exists(
    select 1 from public.profiles p
    where p.id=p_partner_user_id
      and (p.role='admin' or exists(
        select 1 from public.user_permissions up
        where up.user_id=p.id and up.permission_code='S'
      ))
  ) then
    raise exception 'partner does not have Stamp Rally access' using errcode='42501';
  end if;

  insert into public.stamp_exchange_transactions(
    exchange_key,user_a_id,user_b_id,source,location,event_name,timezone,local_date,status
  )
  values(
    p_exchange_key,v_user_a,v_user_b,p_source,
    nullif(trim(p_location),''),
    nullif(trim(p_event_name),''),
    p_timezone,v_local_date,'processing'
  )
  on conflict(exchange_key) do nothing
  returning exchange_key into v_inserted_key;

  if v_inserted_key is null then
    select * into v_existing
    from public.stamp_exchange_transactions
    where exchange_key=p_exchange_key;

    if v_existing.exchange_key is null then
      raise exception 'exchange transaction could not be resolved';
    end if;
    if not (
      v_existing.user_a_id=v_user_a
      and v_existing.user_b_id=v_user_b
    ) then
      raise exception 'exchange key belongs to another participant pair' using errcode='23505';
    end if;
    if v_existing.status='completed' and v_existing.result is not null then
      return v_existing.result || jsonb_build_object('idempotent_replay',true);
    end if;
    raise exception 'exchange is already processing' using errcode='55P03';
  end if;

  select i.ca_member_id,i.community_id,m.ca_level,m.status
    into v_caller_ca,v_caller_community,v_caller_level,v_caller_status
  from public.user_ca_identities i
  join public.ca_members m on m.id=i.ca_member_id
  where i.user_id=p_caller_user_id and i.is_primary
  limit 1;

  select i.ca_member_id,i.community_id,m.ca_level,m.status
    into v_partner_ca,v_partner_community,v_partner_level,v_partner_status
  from public.user_ca_identities i
  join public.ca_members m on m.id=i.ca_member_id
  where i.user_id=p_partner_user_id and i.is_primary
  limit 1;

  if v_caller_ca is null or v_partner_ca is null then
    raise exception 'both users need a primary CA identity before exchanging' using errcode='P0001';
  end if;
  if v_caller_status<>'active' or v_partner_status<>'active'
     or v_caller_level not in ('1st','2nd')
     or v_partner_level not in ('1st','2nd') then
    raise exception 'both CA identities must be active 1st/2nd' using errcode='P0001';
  end if;

  insert into public.stamp_collections(
    owner_user_id,stamp_ca_member_id,community_id,role_at_acquisition,
    first_acquired_at,first_location,first_event_name,acquisition_source
  )
  values(
    p_caller_user_id,v_partner_ca,v_partner_community,v_partner_level,
    v_now,nullif(trim(p_location),''),nullif(trim(p_event_name),''),p_source
  )
  on conflict(owner_user_id,stamp_ca_member_id,community_id) do nothing
  returning id into v_collection_caller;

  if v_collection_caller is not null then
    v_status_caller:='new';
  else
    select id into v_collection_caller
    from public.stamp_collections
    where owner_user_id=p_caller_user_id
      and stamp_ca_member_id=v_partner_ca
      and community_id=v_partner_community;

    insert into public.stamp_reunions(
      collection_id,met_at,local_date,timezone,location,event_name,reunion_source
    )
    values(
      v_collection_caller,v_now,v_local_date,p_timezone,
      nullif(trim(p_location),''),nullif(trim(p_event_name),''),p_source
    )
    on conflict(collection_id,local_date) where local_date is not null do nothing
    returning id into v_reunion_caller;

    v_status_caller:=case when v_reunion_caller is null then 'duplicate_same_day' else 'reunion' end;
  end if;

  insert into public.stamp_collections(
    owner_user_id,stamp_ca_member_id,community_id,role_at_acquisition,
    first_acquired_at,first_location,first_event_name,acquisition_source
  )
  values(
    p_partner_user_id,v_caller_ca,v_caller_community,v_caller_level,
    v_now,nullif(trim(p_location),''),nullif(trim(p_event_name),''),p_source
  )
  on conflict(owner_user_id,stamp_ca_member_id,community_id) do nothing
  returning id into v_collection_partner;

  if v_collection_partner is not null then
    v_status_partner:='new';
  else
    select id into v_collection_partner
    from public.stamp_collections
    where owner_user_id=p_partner_user_id
      and stamp_ca_member_id=v_caller_ca
      and community_id=v_caller_community;

    insert into public.stamp_reunions(
      collection_id,met_at,local_date,timezone,location,event_name,reunion_source
    )
    values(
      v_collection_partner,v_now,v_local_date,p_timezone,
      nullif(trim(p_location),''),nullif(trim(p_event_name),''),p_source
    )
    on conflict(collection_id,local_date) where local_date is not null do nothing
    returning id into v_reunion_partner;

    v_status_partner:=case when v_reunion_partner is null then 'duplicate_same_day' else 'reunion' end;
  end if;

  v_result:=jsonb_build_object(
    'ok',true,
    'exchange_key',p_exchange_key,
    'occurred_at',v_now,
    'timezone',p_timezone,
    'local_date',v_local_date,
    'source',p_source,
    'idempotent_replay',false,
    'participants',jsonb_build_array(
      jsonb_build_object(
        'user_id',p_caller_user_id,
        'received_ca_member_id',v_partner_ca,
        'received_community_id',v_partner_community,
        'collection_id',v_collection_caller,
        'status',v_status_caller
      ),
      jsonb_build_object(
        'user_id',p_partner_user_id,
        'received_ca_member_id',v_caller_ca,
        'received_community_id',v_caller_community,
        'collection_id',v_collection_partner,
        'status',v_status_partner
      )
    )
  );

  update public.stamp_exchange_transactions
  set status='completed',result=v_result,completed_at=now()
  where exchange_key=p_exchange_key;

  return v_result;
end;
$$;

revoke all on function public.stamp_exchange_pair_internal(uuid,uuid,uuid,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.stamp_exchange_pair_internal(uuid,uuid,uuid,text,text,text,text)
  to service_role;

comment on function public.stamp_exchange_pair_internal(uuid,uuid,uuid,text,text,text,text) is
  'Atomic two-way stamp exchange. Service-role only; user authentication is enforced by the stamp-exchange Edge Function.';
