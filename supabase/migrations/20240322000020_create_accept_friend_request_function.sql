-- Create a function to handle accepting friend requests in a transaction
CREATE OR REPLACE FUNCTION accept_friend_request_transaction(
  p_request_id UUID,
  p_user_id UUID,
  p_friend_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- Update the friend request status to accepted
  UPDATE friend_requests 
  SET status = 'accepted'
  WHERE id = p_request_id 
    AND receiver_id = p_user_id 
    AND status = 'pending';
  
  -- Check if the update affected any rows
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found or already processed';
  END IF;
  
  -- Insert the friendship record (only if it doesn't already exist)
  INSERT INTO friends (user_id, friend_id)
  VALUES (p_user_id, p_friend_id)
  ON CONFLICT (user_id, friend_id) DO NOTHING;
  
  -- Also create the reverse friendship for bidirectional relationship
  INSERT INTO friends (user_id, friend_id)
  VALUES (p_friend_id, p_user_id)
  ON CONFLICT (user_id, friend_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION accept_friend_request_transaction(UUID, UUID, UUID) TO authenticated;
