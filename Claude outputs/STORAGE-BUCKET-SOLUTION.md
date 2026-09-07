# Storage Bucket Fix - Complete Solution

## The Problem

Error: `must be owner of table objects`

This happens because **Supabase storage tables are managed by Supabase itself**, and regular users cannot modify RLS policies on them via SQL. We need to:
1. Create the bucket via SQL ✅ (this works)
2. Configure policies via **Supabase Dashboard UI** ✅ (this is required)

---

## Solution: 2-Part Fix

### Part 1: Create the Bucket (SQL)

Run this SQL in Supabase SQL Editor:

```sql
INSERT INTO storage.buckets (id, name, owner, public, created_at, updated_at)
VALUES ('posts', 'posts', (SELECT id FROM auth.users LIMIT 1), true, now(), now())
ON CONFLICT (id) DO UPDATE
  SET public = true
  WHERE storage.buckets.id = 'posts';

SELECT id, name, public FROM storage.buckets WHERE id = 'posts';
```

This creates the `posts` bucket if it doesn't exist.

---

### Part 2: Configure Policies (Dashboard UI)

Go to **Supabase Dashboard** → **Storage** → **Buckets**:

#### Step 1: Find or Create "posts" Bucket
- Click on the `posts` bucket
- Make sure it's marked **PUBLIC** (toggle should be OFF/unchecked)

#### Step 2: Go to Policies Tab
- Click on the bucket name → `posts`
- Click **Policies** tab at the top
- You should see a list of existing policies

#### Step 3: Create Upload Policy
Click **New Policy** → **Create a policy from scratch**

- **Name:** `Allow authenticated uploads`
- **Target role:** `authenticated`
- **Operation:** `INSERT`
- **With Check Expression:**
  ```
  bucket_id = 'posts'
  ```
- Click **Save**

#### Step 4: Create Read Policy
Click **New Policy** → **Create a policy from scratch**

- **Name:** `Allow public read`
- **Target role:** `public` (or `authenticated`)
- **Operation:** `SELECT`
- **Using Expression:**
  ```
  bucket_id = 'posts'
  ```
- Click **Save**

#### Step 5: Create Delete Policy
Click **New Policy** → **Create a policy from scratch**

- **Name:** `Allow authenticated delete own files`
- **Target role:** `authenticated`
- **Operation:** `DELETE`
- **Using Expression:**
  ```
  bucket_id = 'posts' AND auth.uid()::text = (string_to_array(name, '/'))[1]
  ```
- Click **Save**

---

## Verification

After completing all steps:

1. **Go to Storage → Buckets**
2. **Verify "posts" bucket exists** ✅
3. **Click on it, verify it's PUBLIC** ✅
4. **Go to Policies tab, should see 3 policies:**
   - Allow authenticated uploads
   - Allow public read
   - Allow authenticated delete own files

---

## Test the Fix

1. **Go to your app**
2. **Try uploading a photo/video post**
3. **Should upload successfully now!**

If error persists:
- Check browser console (F12) for exact error
- Verify all policies are created
- Verify bucket is PUBLIC (not private)

---

## Why This Approach?

- ❌ Cannot modify storage.objects RLS policies via SQL (permission denied)
- ✅ Must use Supabase Dashboard UI for storage policies
- ✅ Bucket creation via SQL works fine
- ✅ This is the official Supabase way

---

## Quick Reference: Policy Expressions

| Policy | Operation | Expression |
|--------|-----------|------------|
| Upload | INSERT | `bucket_id = 'posts'` |
| Read | SELECT | `bucket_id = 'posts'` |
| Delete Own | DELETE | `bucket_id = 'posts' AND auth.uid()::text = (string_to_array(name, '/'))[1]` |

---

## If You Need Anon/Public Uploads

If you want anonymous users to upload (not recommended for your use case):

- Create policy with role `anon` instead of `authenticated`
- This requires special configuration and security considerations

For now, stick with `authenticated` (logged-in users only).
