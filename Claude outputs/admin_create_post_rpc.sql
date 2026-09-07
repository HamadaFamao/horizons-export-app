-- Create RPC function for admin to create posts for users (bypasses RLS)
CREATE OR REPLACE FUNCTION admin_create_post(
  p_user_id UUID,
  p_type TEXT,
  p_caption TEXT DEFAULT NULL,
  p_media_url TEXT DEFAULT NULL,
  p_visibility TEXT DEFAULT 'public',
  p_is_public BOOLEAN DEFAULT true
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_id UUID;
  v_admin_id UUID;
  v_user_role TEXT;
BEGIN
  -- Get current authenticated user
  v_admin_id := auth.uid();

  -- Check if user is admin (has staff_role set)
  SELECT staff_role INTO v_user_role
  FROM profiles
  WHERE id = v_admin_id;

  -- Allow if user is admin, manager, super_admin, or moderator
  IF v_user_role NOT IN ('admin', 'manager', 'super_admin', 'moderator') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only admins can create posts for other users'
    );
  END IF;

  -- Insert post
  INSERT INTO posts (
    user_id,
    type,
    caption,
    media_url,
    visibility,
    is_public,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_type,
    p_caption,
    p_media_url,
    p_visibility,
    p_is_public,
    true,
    NOW(),
    NOW()
  ) RETURNING id INTO v_post_id;

  RETURN json_build_object(
    'success', true,
    'post_id', v_post_id,
    'message', 'Post created successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION admin_create_post TO authenticated;
