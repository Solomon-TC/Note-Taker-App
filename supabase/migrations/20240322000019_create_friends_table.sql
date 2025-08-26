-- Create friends table for accepted friendships
CREATE TABLE IF NOT EXISTS friends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);

-- Enable RLS
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- RLS Policies for friends table
-- Users can view their own friendships (both as user_id and friend_id)
CREATE POLICY "Users can view own friendships"
ON friends FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Users can insert friendships where they are the user_id
CREATE POLICY "Users can create own friendships"
ON friends FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own friendships
CREATE POLICY "Users can delete own friendships"
ON friends FOR DELETE
USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Enable realtime
alter publication supabase_realtime add table friends;

-- Create function to get user's friends with their details
CREATE OR REPLACE FUNCTION get_user_friends(user_uuid UUID)
RETURNS TABLE (
  friend_id UUID,
  friend_email TEXT,
  friend_name TEXT,
  friendship_created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN f.user_id = user_uuid THEN f.friend_id
      ELSE f.user_id
    END as friend_id,
    u.email as friend_email,
    u.full_name as friend_name,
    f.created_at as friendship_created_at
  FROM friends f
  JOIN users u ON (
    CASE 
      WHEN f.user_id = user_uuid THEN u.id = f.friend_id
      ELSE u.id = f.user_id
    END
  )
  WHERE f.user_id = user_uuid OR f.friend_id = user_uuid
  ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_user_friends(UUID) TO authenticated;
