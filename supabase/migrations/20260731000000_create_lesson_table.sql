CREATE TABLE lesson (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  level TEXT
);
