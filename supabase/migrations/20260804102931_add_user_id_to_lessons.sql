-- Add user_id column to the lessons table
ALTER TABLE public.lesson
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add an index for faster lookups
CREATE INDEX ON public.lesson (user_id);
