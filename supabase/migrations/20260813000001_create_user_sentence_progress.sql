CREATE TABLE public.user_sentence_progress (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sentence_id UUID REFERENCES public.sentence(id) ON DELETE CASCADE NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, sentence_id)
);

ALTER TABLE public.user_sentence_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sentence progress"
ON public.user_sentence_progress
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sentence progress"
ON public.user_sentence_progress
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sentence progress"
ON public.user_sentence_progress
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
