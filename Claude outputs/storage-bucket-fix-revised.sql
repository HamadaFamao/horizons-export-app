-- Storage Bucket Fix - Revised Version
-- Note: Storage policies must be managed via Supabase Dashboard, not SQL

-- 1. Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, owner, public, created_at, updated_at)
VALUES ('posts', 'posts', (SELECT id FROM auth.users LIMIT 1), true, now(), now())
ON CONFLICT (id) DO UPDATE
  SET public = true
  WHERE storage.buckets.id = 'posts';

-- 2. Verify bucket was created
SELECT id, name, public, owner
FROM storage.buckets
WHERE id = 'posts';

-- 3. Check existing storage policies (read-only, for diagnostics)
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual as condition,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
ORDER BY tablename, policyname;
