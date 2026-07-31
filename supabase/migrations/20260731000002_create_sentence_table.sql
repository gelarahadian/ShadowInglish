CREATE TABLE sentence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lesson(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  start_time REAL,
  end_time REAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add an index for faster lookups
CREATE INDEX idx_sentence_lesson_id ON sentence(lesson_id);