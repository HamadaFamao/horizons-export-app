# Post Reports Fix - Complete Implementation Guide

## Step 1: Diagnose Missing Profiles (Run in Supabase SQL Editor)

Go to your Supabase dashboard → SQL Editor and run this query:

```sql
-- Find all user_ids in posts that don't have profiles
SELECT DISTINCT p.user_id, COUNT(*) as post_count
FROM posts p
LEFT JOIN profiles prof ON p.user_id = prof.id
WHERE prof.id IS NULL
GROUP BY p.user_id
ORDER BY post_count DESC;
```

This will show you:
- **user_id**: The missing user ID
- **post_count**: How many posts are orphaned for this user

**Expected Output Example:**
```
user_id                              | post_count
76a9c2ed-9e5d-43c3-bed5-63993d0c3203 | 1
28e8666b-f7b0-434e-92f6-3106267f4663 | 2
```

---

## Step 2: Choose Your Solution

### ✅ Solution 1A: Create Missing Profiles (RECOMMENDED)

**Best for:** A few missing user profiles

**Steps:**

1. **Copy the user_ids from your diagnostic query** (from Step 1)

2. **Run this in your Supabase SQL Editor:**

```sql
-- Create placeholder profiles for orphaned posts
-- Replace the UUIDs with the ones from your diagnostic query
INSERT INTO profiles (id, name, profile_id, created_at, updated_at)
VALUES 
  ('76a9c2ed-9e5d-43c3-bed5-63993d0c3203', 'User 76a9c2ed', 'user_76a9c2ed', NOW(), NOW()),
  ('28e8666b-f7b0-434e-92f6-3106267f4663', 'User 28e8666b', 'user_28e8666b', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
```

3. **Verify it worked:**

```sql
-- Check if profiles were created
SELECT id, name, profile_id FROM profiles 
WHERE id IN ('76a9c2ed-9e5d-43c3-bed5-63993d0c3203', '28e8666b-f7b0-434e-92f6-3106267f4663');
```

4. **Refresh the Admin Reports page** - Post Owner names should now display!

---

### ⚠️ Solution 1B: Delete Orphaned Posts

**Best for:** Many missing profiles or clean up strategy

**Steps:**

1. **First, see which posts will be deleted:**

```sql
-- Preview posts that will be deleted
SELECT p.id, p.type, p.user_id, p.created_at
FROM posts p
LEFT JOIN profiles prof ON p.user_id = prof.id
WHERE prof.id IS NULL
ORDER BY p.created_at DESC;
```

2. **Soft-delete the posts (mark as inactive):**

```sql
-- Soft delete: mark posts as inactive instead of deleting
UPDATE posts 
SET is_active = false 
WHERE user_id NOT IN (SELECT id FROM profiles);
```

3. **Verify:**

```sql
-- Check how many posts were marked as inactive
SELECT COUNT(*) as deactivated_posts
FROM posts
WHERE user_id NOT IN (SELECT id FROM profiles) AND is_active = false;
```

4. **Refresh the Admin Reports page** - Orphaned posts will no longer appear

---

### 🔧 Solution 3: Use PostgreSQL RLS-Aware Function

**Best for:** Complex RLS policies or advanced scenarios**

**Steps:**

1. **Create the PostgreSQL function in your Supabase SQL Editor:**

```sql
CREATE OR REPLACE FUNCTION get_post_reports_with_owners(limit_count INT DEFAULT 20, offset_count INT DEFAULT 0)
RETURNS TABLE (
  report_id UUID,
  post_id INT,
  post_type TEXT,
  post_user_id UUID,
  post_owner_name TEXT,
  reporter_name TEXT,
  reason TEXT,
  status TEXT,
  created_at TIMESTAMP
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
SELECT 
  pr.id::UUID,
  pr.post_id,
  p.type,
  p.user_id,
  prof.name,
  reporter.name,
  pr.reason,
  pr.status,
  pr.created_at
FROM post_reports pr
LEFT JOIN posts p ON pr.post_id = p.id
LEFT JOIN profiles prof ON p.user_id = prof.id
LEFT JOIN profiles reporter ON pr.reporter_id = reporter.id
ORDER BY pr.created_at DESC
LIMIT limit_count OFFSET offset_count;
$$;

-- Grant permission to authenticated users
GRANT EXECUTE ON FUNCTION get_post_reports_with_owners(INT, INT) TO authenticated;
```

2. **Update AdminReports.jsx to use the function:**

```javascript
// In fetchPostReports function, replace the current fetch with:
const { data: enrichedReports, error: rpcError } = await supabase
  .rpc('get_post_reports_with_owners', { 
    limit_count: 20,
    offset_count: 0 
  });

if (rpcError) {
  console.error('[POST_REPORTS] RPC Error:', rpcError);
  return;
}

// Transform the RPC response to match expected format
const reports = enrichedReports.map(report => ({
  id: report.report_id,
  post_id: report.post_id,
  post: {
    id: report.post_id,
    type: report.post_type,
    user_id: report.post_user_id,
  },
  post_owner: report.post_owner_name ? { name: report.post_owner_name } : null,
  reporter: report.reporter_name ? { name: report.reporter_name } : null,
  reason: report.reason,
  status: report.status,
  created_at: report.created_at,
}));

setPostReports(reports);
```

---

## Decision Matrix

| Solution | Best For | Difficulty | Time | When to Use |
|----------|----------|-----------|------|------------|
| **1A: Create Profiles** | Few missing users | Easy | 2 min | Most common case |
| **1B: Delete Posts** | Clean data strategy | Easy | 2 min | Many orphaned posts |
| **3: RLS Function** | Advanced RLS policies | Hard | 15 min | Complex security requirements |

---

## 🎯 Recommended Next Steps

1. **Run the diagnostic query from Step 1** to see how many missing profiles you have
2. **Choose Solution 1A if:** Less than 5 missing user profiles
3. **Choose Solution 1B if:** More than 10 missing user profiles or you want to clean up
4. **Choose Solution 3 if:** You have complex RLS policies preventing profile access

---

## ✅ Verification Checklist

After implementing your chosen solution:

- [ ] Ran diagnostic query successfully
- [ ] Identified missing profiles (or chose to delete orphaned posts)
- [ ] Executed the SQL for your chosen solution
- [ ] Verified the solution worked (see verification queries above)
- [ ] Refreshed Admin Reports page in browser
- [ ] Post Owner shows actual names (not "Unknown")
- [ ] Post Type shows "PHOTO" or "VIDEO" (not "N/A")
- [ ] Media previews appear in modal
- [ ] View Post button works

---

## 💡 Additional Queries for Troubleshooting

**Check total posts vs profiles:**
```sql
SELECT 
  (SELECT COUNT(*) FROM posts) as total_posts,
  (SELECT COUNT(*) FROM profiles) as total_profiles,
  (SELECT COUNT(DISTINCT user_id) FROM posts) as unique_post_users,
  (SELECT COUNT(DISTINCT user_id) FROM posts 
   WHERE user_id NOT IN (SELECT id FROM profiles)) as orphaned_user_count;
```

**See detailed report of orphaned posts:**
```sql
SELECT 
  p.id,
  p.type,
  p.user_id,
  p.created_at,
  (SELECT COUNT(*) FROM post_reports WHERE post_id = p.id) as report_count
FROM posts p
LEFT JOIN profiles prof ON p.user_id = prof.id
WHERE prof.id IS NULL
ORDER BY p.created_at DESC;
```

**Check current AdminReports.jsx posts being fetched:**
```sql
SELECT DISTINCT pr.post_id, p.id, p.type, p.user_id
FROM post_reports pr
LEFT JOIN posts p ON pr.post_id = p.id
LIMIT 10;
```

---

## 🚀 After Your Fix

Once you've implemented your solution:

1. **Refresh the browser** - The Admin Reports page should now show complete data
2. **Test the features:**
   - Click on a post report to open the modal
   - Verify Post Owner shows the name
   - Verify Post Type shows PHOTO or VIDEO
   - Click "View Post" button
   - Check media preview
3. **Report is complete!** 🎉

If you still see "Unknown" or "N/A", there may be an RLS policy issue - use Solution 3 or check your RLS policies.
