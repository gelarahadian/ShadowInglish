CREATE TABLE public.shadowing_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sentence_id UUID REFERENCES public.sentence(id) ON DELETE CASCADE NOT NULL,
  transcribed_text TEXT,
  score INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_shadowing_results_user_sentence ON public.shadowing_results(user_id, sentence_id);

ALTER TABLE public.shadowing_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own shadowing results"
ON public.shadowing_results
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own shadowing results"
ON public.shadowing_results
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
