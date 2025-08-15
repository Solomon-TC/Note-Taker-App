-- Create drawings table for Excalidraw integration
CREATE TABLE IF NOT EXISTS drawings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    note_id uuid NOT NULL,
    title text DEFAULT 'Drawing',
    data_json jsonb NOT NULL DEFAULT '{}',
    image_url text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_drawings_user_id ON drawings(user_id);
CREATE INDEX IF NOT EXISTS idx_drawings_note_id ON drawings(note_id);
CREATE INDEX IF NOT EXISTS idx_drawings_updated_at ON drawings(note_id, updated_at DESC);

-- Add updated_at trigger for drawings table
DROP TRIGGER IF EXISTS update_drawings_updated_at ON drawings;
CREATE TRIGGER update_drawings_updated_at
    BEFORE UPDATE ON drawings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for drawings table
alter publication supabase_realtime add table drawings;
