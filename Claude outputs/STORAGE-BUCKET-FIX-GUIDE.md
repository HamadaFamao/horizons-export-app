# Storage Bucket 400 Error - Diagnosis & Fix

## Problem
The PostUploader component is returning **400 Bad Request** errors when trying to upload files to the storage bucket:
```
POST https://wymywyrdahtahkfxxkkt.supabase.co/storage/v1/object/posts/[uuid]/[timestamp].mp4 400
```

This prevents any posts with media from being created.

## Root Causes (in order of likelihood)

### 1. **Storage Bucket Doesn't Exist** ⚠️ MOST LIKELY
The `posts` storage bucket may not have been created in Supabase yet.

**Check:**
- Go to Supabase Dashboard → Storage → Buckets
- Look for a bucket named `posts`
- If missing, create it manually or run the SQL fix script

### 2. **Storage Bucket RLS Policies Are Too Restrictive**
The bucket may have RLS policies that prevent authenticated users from uploading.

**Symptoms:**
- Bucket exists and is public
- Users still get 400/403 errors on upload

**Solution:**
- Review policies in Supabase dashboard
- Run the provided SQL fix script to create permissive policies

### 3. **Storage Bucket is Private Instead of Public**
If the bucket is set to private, authenticated users may not have upload permissions.

**Check:**
- Supabase Dashboard → Storage → Buckets → Click "posts" bucket
- Look at the "Private" toggle status

**Solution:**
- Set bucket to public (toggle off the Private setting)

### 4. **CORS Configuration Issue** (Less likely for authenticated requests)
Storage CORS settings might be blocking requests.

**Solution:**
- Usually not needed for authenticated requests from same domain
- If needed, configure in Supabase Storage settings

## Recommended Fix Process

### Step 1: Run the Bucket Creation Script
Execute `storage-bucket-simple-fix.sql` in Supabase SQL Editor:

```sql
-- This script will:
-- 1. Create the 'posts' bucket if it doesn't exist
-- 2. Set it to public
-- 3. Enable RLS
-- 4. Create permissive policies for uploads/downloads/deletes
```

### Step 2: Verify Bucket Configuration
After running the script, verify in Supabase Dashboard:
1. Go to Storage → Buckets
2. Confirm "posts" bucket exists and is PUBLIC (toggle off)
3. Click the bucket to see policies are in place

### Step 3: Test the Upload
1. Go to the app and try uploading a post with media
2. Check browser console for any errors
3. Verify the file appears in Storage → objects

## Code Review: PostUploader Component

The upload code is correct:
```javascript
const { error: uploadError } = await supabase.storage
  .from('posts')
  .upload(fileName, file, { upsert: false });

if (uploadError) throw uploadError;
```

**File path format:** `${targetUserId}/${Date.now()}.${ext}`
- Example: `550e8400-e29b-41d4-a716-446655440000/1697234567890.mp4`
- This is a valid path

## If Problem Persists After Fix

1. **Check Console Errors:**
   - Open browser DevTools → Console
   - Look for specific error messages from Supabase
   - Copy the full error and search Supabase docs

2. **Verify Authentication:**
   - Ensure user is logged in
   - Check auth token is valid
   - Verify `supabase.auth.getSession()` returns a session

3. **Check Supabase Client:**
   - Ensure NEXT_PUBLIC_SUPABASE_URL is correct
   - Ensure NEXT_PUBLIC_SUPABASE_ANON_KEY is valid
   - These should match your Supabase project settings

4. **Check File Size:**
   - Component limits: 10MB for images, 100MB for videos
   - Supabase default limits may differ
   - Try with a very small file to test

5. **CORS Settings (if needed):**
   - Supabase Dashboard → Settings → Storage → CORS settings
   - Add your domain (getfamo.com) if using custom domain

## Quick Checklist

- [ ] Run storage bucket creation/fix SQL script
- [ ] Verify "posts" bucket exists in Supabase
- [ ] Confirm bucket is PUBLIC (not private)
- [ ] Check RLS policies are created
- [ ] Test upload in app
- [ ] Check browser console for errors
- [ ] Verify file appears in Storage
- [ ] Check user authentication is active

## Files to Execute

1. **Primary Fix:**
   - `storage-bucket-simple-fix.sql` - Run this first

2. **Diagnostic:**
   - `storage-diagnostic.sql` - Run this to check current state

## Expected Outcome

After running the fix script:
- Users can upload photos/videos to posts
- Files are stored in `posts` bucket under user folder
- Posts are created successfully in database
- No more 400 errors
