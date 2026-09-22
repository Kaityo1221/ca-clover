alter table public.profiles
  add column if not exists stamp_exchange_message text;

alter table public.profiles
  drop constraint if exists profiles_stamp_exchange_message_length_ck;
alter table public.profiles
  add constraint profiles_stamp_exchange_message_length_ck
  check (stamp_exchange_message is null or char_length(stamp_exchange_message) <= 24);

comment on column public.profiles.stamp_exchange_message is
  'Short CA message copied into a newly acquired stamp at exchange time. Maximum 24 characters.';

alter table public.stamp_collections
  add column if not exists acquisition_message text,
  add column if not exists acquisition_message_seen_at timestamptz;

alter table public.stamp_collections
  drop constraint if exists stamp_collections_acquisition_message_length_ck;
alter table public.stamp_collections
  add constraint stamp_collections_acquisition_message_length_ck
  check (acquisition_message is null or char_length(acquisition_message) <= 24);

comment on column public.stamp_collections.acquisition_message is
  'Immutable snapshot of the stamp owner CA message at first acquisition.';
comment on column public.stamp_collections.acquisition_message_seen_at is
  'When the owner first opened the badge and saw the acquisition message.';

create or replace function public.set_stamp_exchange_message(p_message text)
returns text
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_message text := nullif(trim(coalesce(p_message,'')),'');
begin
  if v_user_id is null then
    raise exception 'ログインが必要です' using errcode='42501';
  end if;
  if v_message is not null and char_length(v_message) > 24 then
    raise exception 'スタンプ交換時の一言は24文字以内で入力してください' using errcode='22023';
  end if;

  update public.profiles
  set stamp_exchange_message=v_message
  where id=v_user_id;

  if not found then
    raise exception 'profile not found' using errcode='P0001';
  end if;
  return v_message;
end;
$$;

revoke all on function public.set_stamp_exchange_message(text) from public,anon;
grant execute on function public.set_stamp_exchange_message(text) to authenticated;

create or replace function public.stamp_collection_mark_message_seen(p_collection_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_seen_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です' using errcode='42501';
  end if;

  update public.stamp_collections
  set acquisition_message_seen_at=coalesce(acquisition_message_seen_at,now())
  where id=p_collection_id
    and owner_user_id=auth.uid()
  returning acquisition_message_seen_at into v_seen_at;

  if v_seen_at is null then
    raise exception 'スタンプが見つかりません' using errcode='P0001';
  end if;
  return v_seen_at;
end;
$$;

revoke all on function public.stamp_collection_mark_message_seen(uuid) from public,anon;
grant execute on function public.stamp_collection_mark_message_seen(uuid) to authenticated;

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
  v_caller_message text;

  v_partner_ca uuid;
  v_partner_community uuid;
  v_partner_level text;
  v_partner_status text;
  v_partner_message text;

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

  select nullif(trim(stamp_exchange_message),'')
    into v_caller_message
  from public.profiles
  where id=p_caller_user_id;

  select nullif(trim(stamp_exchange_message),'')
    into v_partner_message
  from public.profiles
  where id=p_partner_user_id;

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
    first_acquired_at,first_location,first_event_name,acquisition_source,acquisition_message
  )
  values(
    p_caller_user_id,v_partner_ca,v_partner_community,v_partner_level,
    v_now,nullif(trim(p_location),''),nullif(trim(p_event_name),''),p_source,v_partner_message
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
    first_acquired_at,first_location,first_event_name,acquisition_source,acquisition_message
  )
  values(
    p_partner_user_id,v_caller_ca,v_caller_community,v_caller_level,
    v_now,nullif(trim(p_location),''),nullif(trim(p_event_name),''),p_source,v_caller_message
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
