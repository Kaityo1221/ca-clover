create table if not exists public.community_ca_members(
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  ca_member_id uuid not null references public.ca_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(community_id, ca_member_id)
);

alter table public.community_ca_members enable row level security;

create policy "admin reads community ca links"
on public.community_ca_members
for select
to authenticated
using(public.is_admin());
