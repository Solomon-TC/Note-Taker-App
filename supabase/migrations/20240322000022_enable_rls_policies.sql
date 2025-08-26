-- Enable Row Level Security on users, friend_requests, and friends tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- Policies for users table
-- Users can only SELECT their own record
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Policies for friend_requests table
-- Users can INSERT if they are the sender
DROP POLICY IF EXISTS "Users can send friend requests" ON friend_requests;
CREATE POLICY "Users can send friend requests"
  ON friend_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Users can SELECT requests they are involved in (sender or receiver)
DROP POLICY IF EXISTS "Users can view their friend requests" ON friend_requests;
CREATE POLICY "Users can view their friend requests"
  ON friend_requests FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can UPDATE request status if they are the receiver
DROP POLICY IF EXISTS "Users can update received requests" ON friend_requests;
CREATE POLICY "Users can update received requests"
  ON friend_requests FOR UPDATE
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- Allow DELETE for friend requests (needed for unfriend cleanup)
DROP POLICY IF EXISTS "Users can delete their friend requests" ON friend_requests;
CREATE POLICY "Users can delete their friend requests"
  ON friend_requests FOR DELETE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Policies for friends table
-- Users can INSERT if they are part of the friendship
DROP POLICY IF EXISTS "Users can create friendships" ON friends;
CREATE POLICY "Users can create friendships"
  ON friends FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

-- Users can SELECT friendships they are part of
DROP POLICY IF EXISTS "Users can view their friendships" ON friends;
CREATE POLICY "Users can view their friendships"
  ON friends FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Users can DELETE friendships they are part of
DROP POLICY IF EXISTS "Users can delete their friendships" ON friends;
CREATE POLICY "Users can delete their friendships"
  ON friends FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Enable realtime for the tables
alter publication supabase_realtime add table users;
alter publication supabase_realtime add table friend_requests;
alter publication supabase_realtime add table friends;
