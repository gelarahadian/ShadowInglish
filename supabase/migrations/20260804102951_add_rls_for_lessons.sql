-- Enable Row Level Security for the lesson table
ALTER TABLE public.lesson ENABLE ROW LEVEL SECURITY;

-- Allow public read access for official lessons (where user_id is null)
CREATE POLICY "Public can view official lessons"
ON public.lesson
FOR SELECT
USING (user_id IS NULL);

-- Allow users to view their own lessons
CREATE POLICY "Users can view their own lessons"
ON public.lesson
FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to insert their own lessons
CREATE POLICY "Users can create their own lessons"
ON public.lesson
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own lessons
CREATE POLICY "Users can update their own lessons"
ON public.lesson
FOR UPDATE
USING (auth.uid() = user_id);

-- Allow users to delete their own lessons
CREATE POLICY "Users can delete their own lessons"
ON public.lesson
FOR DELETE
USING (auth.uid() = user_id);
