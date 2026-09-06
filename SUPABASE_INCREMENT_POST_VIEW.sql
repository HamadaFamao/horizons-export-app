-- Create or replace the increment_post_view RPC function
CREATE OR REPLACE FUNCTION increment_post_view(p_post_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_view_count INT;
BEGIN
  -- Update the view count
  UPDATE posts 
  SET view_count = view_count + 1
  WHERE id = p_post_id
  RETURNING view_count INTO v_view_count;
  
  RETURN json_build_object('success', true, 'view_count', v_view_count);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION increment_post_view(UUID) TO authenticated, anon;
