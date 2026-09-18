revoke update on public.profiles from authenticated;
grant update (niantic_id) on public.profiles to authenticated;

drop policy if exists "admin reads community ca links" on public.community_ca_members;
create policy "read allowed community ca links"
on public.community_ca_members
for select
to authenticated
using(
  private.is_admin()
  or exists(
    select 1
    from public.community_memberships m
    where m.community_id = community_ca_members.community_id
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists "admin reads ca master" on public.ca_members;
create policy "read allowed ca master"
on public.ca_members
for select
to authenticated
using(
  private.is_admin()
  or exists(
    select 1
    from public.community_ca_members l
    join public.community_memberships m
      on m.community_id = l.community_id
    where l.ca_member_id = ca_members.id
      and m.user_id = (select auth.uid())
  )
);
