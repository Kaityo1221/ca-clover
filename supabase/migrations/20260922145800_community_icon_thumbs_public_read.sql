drop policy if exists "community icon thumbs public read" on storage.objects;

create policy "community icon thumbs public read"
on storage.objects
for select
to public
using (bucket_id = 'community-icon-thumbs');
