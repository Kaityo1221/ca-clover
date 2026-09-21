drop policy if exists "stamp access reads communities" on public.communities;
drop policy if exists "stamp access reads community ca links" on public.community_ca_members;
drop policy if exists "stamp access reads ca master" on public.ca_members;

create or replace function public.stamp_rally_catalog()
returns table(
  community_id uuid,
  community_name text,
  prefecture text,
  avatar_url text,
  avatar_thumbnail_path text,
  avatar_last_changed_at timestamptz,
  ca_member_id uuid,
  trainer_name text,
  ca_level text
)
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not private.is_admin() and not private.has_permission('S') then
    raise exception 'stamp rally access required'
      using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.name,
    c.prefecture,
    c.avatar_url,
    c.avatar_thumbnail_path,
    c.avatar_last_changed_at,
    m.id,
    m.trainer_name,
    m.ca_level
  from public.communities c
  left join public.community_ca_members l
    on l.community_id = c.id
  left join public.ca_members m
    on m.id = l.ca_member_id
  order by c.prefecture nulls last, c.name, m.ca_level nulls last, m.trainer_name nulls last;
end;
$$;

revoke all on function public.stamp_rally_catalog() from public, anon;
grant execute on function public.stamp_rally_catalog() to authenticated;

comment on function public.stamp_rally_catalog() is
  'Restricted Stamp Rally catalog. Exposes only Community identity/icon and CA identity/role to ADMIN or S users.';
