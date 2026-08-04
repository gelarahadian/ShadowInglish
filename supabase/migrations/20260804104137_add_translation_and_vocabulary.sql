-- Add translation column to sentences table
ALTER TABLE public.sentence
ADD COLUMN translation TEXT;

-- Create vocabulary_items table
CREATE TABLE public.vocabulary_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID REFERENCES public.lesson(id) ON DELETE CASCADE NOT NULL,
    word TEXT NOT NULL,
    meaning TEXT NOT NULL,
    pronunciation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS for the new table and add policies
ALTER TABLE public.vocabulary_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view vocabulary"
ON public.vocabulary_items
FOR SELECT
USING (true);

CREATE POLICY "Users can manage their own vocabulary"
ON public.vocabulary_items
FOR ALL
USING (
  (SELECT auth.uid()) IN (
    SELECT user_id FROM public.lesson WHERE id = lesson_id
  )
);
