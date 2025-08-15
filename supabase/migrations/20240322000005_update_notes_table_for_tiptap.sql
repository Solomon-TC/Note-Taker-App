-- Update notes table to support Tiptap JSON content
ALTER TABLE notes ADD COLUMN IF NOT EXISTS content_json jsonb NOT NULL DEFAULT '{}';

-- Add index for better performance on content_json queries
CREATE INDEX IF NOT EXISTS idx_notes_content_json ON notes USING gin (content_json);

-- Update existing notes to have empty JSON content if null
UPDATE notes SET content_json = '{}' WHERE content_json IS NULL;

-- Add updated_at trigger for notes table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_notes_updated_at ON notes;
CREATE TRIGGER update_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for notes table
alter publication supabase_realtime add table notes;
