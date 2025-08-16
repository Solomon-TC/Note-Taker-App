CREATE TABLE IF NOT EXISTS ai_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL CHECK (session_type IN ('chat', 'summary', 'practice')),
  title TEXT NOT NULL,
  context JSONB,
  messages JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_sessions_user_id_idx ON ai_sessions(user_id);
CREATE INDEX IF NOT EXISTS ai_sessions_session_type_idx ON ai_sessions(session_type);
CREATE INDEX IF NOT EXISTS ai_sessions_created_at_idx ON ai_sessions(created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE ai_sessions;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_ai_sessions_updated_at_trigger
  BEFORE UPDATE ON ai_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_sessions_updated_at();