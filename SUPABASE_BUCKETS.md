# Supabase Storage Buckets Setup

This application requires the following storage buckets to be created in your Supabase project. **These must be created manually in your Supabase dashboard - the app cannot create them automatically due to Row Level Security policies.**

## Required Buckets

### 1. `room_avatars`
- **Purpose**: Store room avatar images
- **Public**: Yes (check the "Public bucket" option)
- **Allowed MIME Types**: `image/png`, `image/gif`
- **File Size Limit**: 5MB (5242880 bytes)

### 2. `profile-photos`
- **Purpose**: Store user profile photos and gallery images
- **Public**: Yes (check the "Public bucket" option)
- **Allowed MIME Types**: `image/png`, `image/gif`, `image/jpeg`, `image/webp`
- **File Size Limit**: 5MB (5242880 bytes)

### 3. `room_backgrounds`
- **Purpose**: Store room background images
- **Public**: Yes (check the "Public bucket" option)
- **Allowed MIME Types**: `image/png`, `image/gif`
- **File Size Limit**: 5MB (5242880 bytes)

## How to Create Buckets

1. **Go to your Supabase Dashboard**
   - Open your project dashboard at https://supabase.com/dashboard

2. **Navigate to Storage**
   - Click on "Storage" in the left sidebar

3. **Create First Bucket**
   - Click the "Create bucket" button
   - Enter bucket name: `room_avatars`
   - Check "Public bucket" (important!)
   - Click "Create bucket"

4. **Configure Bucket Settings**
   - After creation, click on the bucket name
   - Go to "Configuration" tab
   - Set "Allowed MIME types": `image/png,image/gif`
   - Set "File size limit": `5242880` (5MB)

5. **Create Second Bucket**
   - Repeat steps 3-4 for bucket name: `profile-photos`
   - Set "Allowed MIME types": `image/png,image/gif,image/jpeg,image/webp`

6. **Create Third Bucket**
   - Repeat steps 3-4 for bucket name: `room_backgrounds`
   - Set "Allowed MIME types": `image/png,image/gif`

## Bucket Policies

For the `room_backgrounds` bucket, add policies that allow authenticated users to upload/update/delete and public users to read:

```sql
create policy "room_backgrounds select public" on storage.objects
  for select using (bucket_id = 'room_backgrounds');

create policy "room_backgrounds insert authenticated" on storage.objects
  for insert with check (bucket_id = 'room_backgrounds' AND auth.role() = 'authenticated')
  using (bucket_id = 'room_backgrounds' AND auth.role() = 'authenticated');

create policy "room_backgrounds update authenticated" on storage.objects
  for update with check (bucket_id = 'room_backgrounds' AND auth.role() = 'authenticated')
  using (bucket_id = 'room_backgrounds' AND auth.role() = 'authenticated');

create policy "room_backgrounds delete authenticated" on storage.objects
  for delete using (bucket_id = 'room_backgrounds' AND auth.role() = 'authenticated');
```

If you want the same policy applied for `room_avatars`, use the same pattern with `bucket_id = 'room_avatars'`.

### Room schema update

If the `background_url` column does not exist on `live_rooms`, add it with:

```sql
alter table live_rooms
  add column if not exists background_url text;
```

## Troubleshooting

If you still get upload errors after creating the buckets:

### Error: "Storage bucket 'room_avatars' does not exist"
- **Cause**: Bucket not created or wrong name
- **Solution**: Double-check bucket name is exactly `room_avatars` (case-sensitive)

### Error: "new row violates row-level security policy"
- **Cause**: Attempting to create bucket programmatically (not allowed)
- **Solution**: Must create buckets manually in dashboard

### Error: "Permission denied" or "Access denied"
- **Cause**: Bucket not set to public or missing policies
- **Solution**: Ensure bucket is public and has proper CORS settings

### Error: "File type not allowed"
- **Cause**: Wrong MIME types configured
- **Solution**: Check allowed MIME types match uploaded file types

### Verification Steps

1. **Check bucket exists**:
   - Go to Supabase Dashboard → Storage
   - Look for `room_avatars` and `profile-photos` in the list

2. **Check bucket settings**:
   - Click on bucket name
   - Go to "Configuration" tab
   - Verify "Public bucket" is checked
   - Verify MIME types are correct

3. **Test upload**:
   - Try uploading a small PNG file
   - Check browser console for detailed error messages

### Browser Console Logs

When uploading, check console for logs like:
```
[ROOM_AVATAR_UPLOAD] Bucket in list: true/false
[ROOM_AVATAR_UPLOAD] Upload successful
```

If bucket shows as "false" in list but upload works, the list permissions might be restricted but upload permissions are fine.

## Error Messages

- `"Storage bucket 'room_avatars' does not exist"` → Create the bucket as described above
- `"new row violates row-level security policy"` → This confirms buckets must be created manually