-- Add background_url column if it does not already exist
alter table live_rooms
  add column if not exists background_url text;

-- Storage policies for room_backgrounds bucket
create policy "room_backgrounds select public" on storage.objects
  for select using (bucket_id = 'room_backgrounds');

create policy "room_backgrounds insert authenticated" on storage.objects
  for insert with check (bucket_id = 'room_backgrounds' and auth.role() = 'authenticated')
  using (bucket_id = 'room_backgrounds' and auth.role() = 'authenticated');

create policy "room_backgrounds update authenticated" on storage.objects
  for update with check (bucket_id = 'room_backgrounds' and auth.role() = 'authenticated')
  using (bucket_id = 'room_backgrounds' and auth.role() = 'authenticated');

create policy "room_backgrounds delete authenticated" on storage.objects
  for delete using (bucket_id = 'room_backgrounds' and auth.role() = 'authenticated');
