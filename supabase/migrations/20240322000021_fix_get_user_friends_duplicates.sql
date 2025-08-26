-- Fix the get_user_friends function to prevent duplicate friends
-- This ensures each friend is only returned once regardless of the friendship direction

CREATE OR REPLACE FUNCTION get_user_friends(user_uuid uuid)
RETURNS TABLE (
  friend_id uuid,
  friend_email text,
  friend_name text,
  friendship_created_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    CASE 
      WHEN f.user_id = user_uuid THEN f.friend_id
      ELSE f.user_id
    END as friend_id,
    u.email as friend_email,
    u.full_name as friend_name,
    f.created_at as friendship_created_at
  FROM friends f
  JOIN users u ON (
    (f.user_id = user_uuid AND u.id = f.friend_id) OR
    (f.friend_id = user_uuid AND u.id = f.user_id)
  )
  WHERE f.user_id = user_uuid OR f.friend_id = user_uuid
  ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_friends(uuid) TO authenticated;
