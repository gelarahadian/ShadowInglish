"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function completeSentence(sentenceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in to track lesson progress." };

  const { error } = await supabase.from("user_sentence_progress").upsert(
    { user_id: user.id, sentence_id: sentenceId, completed_at: new Date().toISOString() },
    { onConflict: "user_id,sentence_id" },
  );

  if (error) return { error: "Could not save sentence progress." };
  return { success: true };
}

export async function deleteLesson(lessonId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to delete a lesson." };
  }

  // Ensure the user owns the lesson before deleting.
  const { data: lesson, error: fetchError } = await supabase
    .from("lesson")
    .select("user_id")
    .eq("id", lessonId)
    .single();

  if (fetchError || !lesson) {
    return { error: "Lesson not found." };
  }

  if (lesson.user_id !== user.id) {
    return { error: "You are not authorized to delete this lesson." };
  }

  const { error: deleteError } = await supabase
    .from("lesson")
    .delete()
    .eq("id", lessonId);

  if (deleteError) {
    return { error: "Could not delete the lesson." };
  }

  revalidatePath("/lessons");
  redirect("/lessons");
}
