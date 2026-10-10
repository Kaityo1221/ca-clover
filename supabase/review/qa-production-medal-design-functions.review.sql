-- REVIEW / QA ONLY. The function bodies below mirror the functions read
-- from live Supabase pg_get_functiondef on 2026-10-10.
-- They are installed ONLY in disposable PostgreSQL used by GitHub Actions.
-- Do not deploy them in production or treat this as a migration.

create or replace function private.stamp_prepare_collection_design()
returns trigger
language plpgsql
security definer
set search_path TO 'public', 'private', 'pg_temp'
as $function$
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
$function$;

create or replace function private.stamp_grant_acquisition_design()
returns trigger
language plpgsql
security definer
set search_path TO 'public', 'private', 'pg_temp'
as $function$
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
$function$;

create or replace function private.stamp_auto_own_medal_after_role()
returns trigger
language plpgsql
security definer
set search_path TO 'public', 'private', 'pg_temp'
as $function$
BEGIN
  IF NEW.role IN ('ca','admin') THEN
    PERFORM private.stamp_ensure_own_medal(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

create trigger stamp_prepare_collection_design
before insert on public.stamp_collections for each row
execute function private.stamp_prepare_collection_design();

create trigger stamp_grant_acquisition_design
after insert on public.stamp_collections for each row
execute function private.stamp_grant_acquisition_design();

create trigger stamp_auto_own_medal_after_role
after update of role on public.profiles for each row
execute function private.stamp_auto_own_medal_after_role();
