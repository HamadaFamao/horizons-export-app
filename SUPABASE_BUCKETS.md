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

## Bucket Policies

The buckets will inherit default policies. For production, you may want to add custom RLS policies to restrict uploads to authenticated users only.

## Troubleshooting

If you still get upload errors after creating the buckets:
- Make sure the buckets are set to "Public"
- Check that the MIME types are configured correctly
- Verify your Supabase service key has storage permissions
- Check browser console for detailed error messages

## Error Messages

- `"Storage bucket 'room_avatars' does not exist"` → Create the bucket as described above
- `"new row violates row-level security policy"` → This confirms buckets must be created manually