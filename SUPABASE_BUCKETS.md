# Supabase Storage Buckets Setup

This application requires the following storage buckets to be created in your Supabase project:

## Required Buckets

### 1. `room_avatars`
- **Purpose**: Store room avatar images
- **Public**: Yes
- **Allowed MIME Types**: `image/png`, `image/gif`
- **File Size Limit**: 5MB

### 2. `profile-photos`
- **Purpose**: Store user profile photos and gallery images
- **Public**: Yes
- **Allowed MIME Types**: `image/png`, `image/gif`, `image/jpeg`, `image/webp`
- **File Size Limit**: 5MB

## Automatic Creation

The application will automatically create these buckets if they don't exist when uploading files. However, if you prefer to create them manually:

1. Go to your Supabase Dashboard
2. Navigate to Storage
3. Click "Create bucket"
4. Enter the bucket name and configure the settings as above

## Bucket Policies

Make sure the buckets have appropriate RLS (Row Level Security) policies for your use case. The application handles authentication and authorization in the application code.