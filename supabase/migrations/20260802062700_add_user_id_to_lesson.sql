ALTER TABLE public.lesson
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.lesson.user_id IS 'The user who created the lesson. NULL for official lessons.';
