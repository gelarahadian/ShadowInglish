-- 1. Create a policy for the "lesson" table
CREATE POLICY "Allow authenticated users to read lessons"
ON public.lesson
FOR SELECT
TO authenticated
USING (true);

-- 2. Create a policy for the "sentence" table
CREATE POLICY "Allow authenticated users to read sentences"
ON public.sentence
FOR SELECT
TO authenticated
USING (true);
