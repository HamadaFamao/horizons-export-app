# Quick Start: Fix Post Reports in 5 Minutes

## 🎯 Your Current Problem
- Post Owner showing "Unknown" 
- Post Type showing "N/A"
- Missing profile records in database for posts

## ✅ The Fix (Choose One)

### Option 1: Create Missing Profiles (Most Common)

**In Supabase SQL Editor:**

```sql
-- Step 1: See what's missing
SELECT DISTINCT p.user_id, COUNT(*) as post_count
FROM posts p
LEFT JOIN profiles prof ON p.user_id = prof.id
WHERE prof.id IS NULL
GROUP BY p.user_id;

-- Step 2: Create profiles for those users
-- Replace UUIDs with the ones from Step 1
INSERT INTO profiles (id, name, profile_id, created_at, updated_at)
VALUES 
  ('YOUR-UUID-HERE', 'User 1', 'user_1', NOW(), NOW()),
  ('YOUR-UUID-HERE', 'User 2', 'user_2', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
```

**Then:** Refresh browser → Done! ✨

---

### Option 2: Delete Orphaned Posts

**In Supabase SQL Editor:**

```sql
UPDATE posts 
SET is_active = false 
WHERE user_id NOT IN (SELECT id FROM profiles);
```

**Then:** Refresh browser → Done! ✨

---

## 📋 Verification

After your fix, in browser:
1. Open Admin Panel
2. Click "Post Reports" tab
3. Check if post owner names appear
4. Check if post type shows PHOTO/VIDEO

---

## 🆘 Still Not Working?

If post names still show "Unknown":
- Check browser console (F12) for errors
- Make sure you hit refresh (Ctrl+Shift+R for hard refresh)
- Check RLS policies in Supabase
- Use Solution 3 in the full guide

---

**Full guide:** See DIAGNOSTIC_AND_IMPLEMENTATION_GUIDE.md
