# Supabase Buckets Creation Script

This script helps you create the required storage buckets for the application.

## Prerequisites

1. Install Supabase CLI: `npm install -g supabase`
2. Login to Supabase: `supabase login`
3. Link your project: `supabase link --project-ref YOUR_PROJECT_REF`

## Create Buckets

Run the following commands in your terminal:

```bash
# Create room_avatars bucket
supabase storage create room_avatars --public

# Create profile-photos bucket
supabase storage create profile-photos --public

# Create room_backgrounds bucket
supabase storage create room_backgrounds --public

# Set MIME types for room_avatars (PNG and GIF only)
supabase storage update room_avatars --allowed-mime-types "image/png,image/gif"

# Set MIME types for profile-photos (PNG, GIF, JPEG, WebP)
supabase storage update profile-photos --allowed-mime-types "image/png,image/gif,image/jpeg,image/webp"

# Set MIME types for room_backgrounds (PNG and GIF only)
supabase storage update room_backgrounds --allowed-mime-types "image/png,image/gif"

# Set file size limit to 5MB for all buckets
supabase storage update room_avatars --file-size-limit 5242880
supabase storage update profile-photos --file-size-limit 5242880
supabase storage update room_backgrounds --file-size-limit 5242880
```

## Alternative: Manual Creation

If you prefer to create buckets manually through the dashboard:

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Storage
4. Click "Create bucket"
5. Follow the instructions in SUPABASE_BUCKETS.md

## Verification

After creating buckets, you can verify they exist by running:

```bash
supabase storage list
```

This should show both `room_avatars` and `profile-photos` buckets.