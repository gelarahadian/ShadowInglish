-- Get the ID of the 'First Step in Shadowing' lesson
WITH lesson_id_cte AS (
  SELECT id FROM lesson WHERE title = 'First Step in Shadowing' LIMIT 1
)
INSERT INTO sentence (lesson_id, text, "order", start_time, end_time) VALUES
((SELECT id FROM lesson_id_cte), 'Hello, and welcome to your first shadowing lesson.', 1, 0, 3.5),
((SELECT id FROM lesson_id_cte), 'Shadowing is a powerful technique to improve your pronunciation and fluency.', 2, 4, 9),
((SELECT id FROM lesson_id_cte), 'Listen carefully to the model audio.', 3, 9.5, 12),
((SELECT id FROM lesson_id_cte), 'Then, try to imitate it as closely as you can.', 4, 12.5, 16);