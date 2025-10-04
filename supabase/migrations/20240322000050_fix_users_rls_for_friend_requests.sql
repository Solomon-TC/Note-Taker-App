DROP POLICY IF EXISTS "Users can view basic profile info for friend requests" ON users;
CREATE POLICY "Users can view basic profile info for friend requests"
  ON users FOR SELECT
  USING (
    auth.uid() = id 
    OR 
    EXISTS (
      SELECT 1 FROM friend_requests 
      WHERE (sender_id = auth.uid() AND receiver_id = users.id)
         OR (receiver_id = auth.uid() AND sender_id = users.id)
    )
    OR
    EXISTS (
      SELECT 1 FROM friends
      WHERE (user_id = auth.uid() AND friend_id = users.id)
         OR (friend_id = auth.uid() AND user_id = users.id)
    )
  );
