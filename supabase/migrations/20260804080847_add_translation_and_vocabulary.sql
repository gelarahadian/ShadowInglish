-- Add translation column to sentences table
ALTER TABLE sentences
ADD COLUMN translation TEXT;

-- Create vocabulary_items table
CREATE TABLE vocabulary_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
    word TEXT NOT NULL,
    meaning TEXT NOT NULL,
    pronunciation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS for the new table
ALTER TABLE vocabulary_items ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Public read access for vocabulary"
ON vocabulary_items
FOR SELECT
USING (true);

-- Create policy for admin full access
CREATE POLICY "Admin full access for vocabulary"
ON vocabulary_items
FOR ALL
USING (true)
WITH CHECK (true);
