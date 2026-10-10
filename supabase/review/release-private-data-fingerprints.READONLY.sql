-- REVIEW / READ ONLY: identity and medal data integrity fingerprints.
-- No UUIDs, account information or medal metadata are returned.
-- Save output privately; checksums are NOT a backup and cannot restore data.
-- Run immediately before AND after explicitly approved production changes.
-- Do not paste the result into the public PR, CI logs or shared issue.
select
  now() as observed_at,
  'user_ca_identities' as table_name,
  count(*) as row_count,
  md5(coalesce(string_agg(to_jsonb(t)::text,E'\n'
      order by t.user_id,t.ca_member_id,t.community_id),''))
      as change_fingerprint
from public.user_ca_identities t
union all
select
  now(),'stamp_collections',count(*),
  md5(coalesce(string_agg(to_jsonb(t)::text,E'\n'
      order by t.id),''))
from public.stamp_collections t
union all
select
  now(),'community_memberships',count(*),
  md5(coalesce(string_agg(to_jsonb(t)::text,E'\n'
      order by t.user_id,t.community_id),''))
from public.community_memberships t
union all
select
  now(),'stamp_collection_designs',count(*),
  md5(coalesce(string_agg(to_jsonb(t)::text,E'\n'
      order by t.collection_id,t.icon_version_id),''))
from public.stamp_collection_designs t
union all
select
  now(),'community_ca_members',count(*),
  md5(coalesce(string_agg(to_jsonb(t)::text,E'\n'
      order by t.community_id,t.ca_member_id),''))
from public.community_ca_members t
order by table_name;