-- Simpler Storage Bucket Fix - Removes restrictive path checking

-- 1. Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, owner, public, created_at, updated_at)
VALUES ('posts', 'posts', (SELECT id FROM auth.users LIMIT 1), true, now(), now())
ON CONFLICT (id) DO UPDATE
  SET public = true
  WHERE storage.buckets.id = 'posts';

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can upload to posts bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read posts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their own posts" ON storage.objects;
DROP POLICY IF EXISTS "Public can read posts" ON storage.objects;

-- 3. Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 4. Simple policy: Authenticated users can upload anything to posts bucket
CREATE POLICY "Allow authenticated uploads to posts" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'posts' AND auth.role() = 'authenticated');

-- 5. Simple policy: Everyone can read posts (public posts)
CREATE POLICY "Allow public read of posts" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'posts');

-- 6. Simple policy: Users can delete their own files (by checking object path starts with their UUID)
CREATE POLICY "Allow delete own posts" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'posts'
    AND auth.role() = 'authenticated'
    AND name LIKE (auth.uid()::text || '%')
  );

-- Verify bucket configuration
SELECT 'Bucket Configuration' as check_type, id, name, public FROM storage.buckets WHERE id = 'posts'
UNION ALL
SELECT 'RLS Enabled' as check_type, 'storage.objects'::regclass::text, schemaname, tablename FROM pg_tables WHERE tablename = 'objects' AND schemaname = 'storage';
