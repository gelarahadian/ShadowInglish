"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";

const formSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]),
  sentences: z.string().min(10),
});

export async function createLesson(values: z.infer<typeof formSchema>) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to create a lesson." };
  }

  // 1. Insert the lesson and get its ID
  const { data: lessonData, error: lessonError } = await supabase
    .from("lesson")
    .insert({
      title: values.title,
      description: values.description,
      level: values.level,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (lessonError || !lessonData) {
    console.error("Error creating lesson:", lessonError);
    return { error: "Could not create the lesson." };
  }

  const lessonId = lessonData.id;

  // 2. Prepare and insert the sentences
  const sentencesToInsert = values.sentences
    .split("\n")
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .map((text, index) => ({
      lesson_id: lessonId,
      text: text,
      timestamp: index, // Using index as a simple timestamp/order
    }));

  if (sentencesToInsert.length === 0) {
    // Rollback? For now, let's just error out. A better implementation would use a transaction.
    return { error: "No valid sentences provided." };
  }

  const { error: sentencesError } = await supabase
    .from("sentence")
    .insert(sentencesToInsert);

  if (sentencesError) {
    console.error("Error creating sentences:", sentencesError);
    // TODO: Delete the lesson that was just created to avoid orphaned lessons.
    return { error: "Could not save the sentences." };
  }

  // 3. Revalidate paths and redirect
  revalidatePath("/lessons");
  redirect(`/lessons/${lessonId}`);
}
