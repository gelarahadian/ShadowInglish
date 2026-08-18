"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function completeSentence(sentenceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Anda harus masuk untuk melacak progres pelajaran." };

  const { error } = await supabase.from("user_sentence_progress").upsert(
    { user_id: user.id, sentence_id: sentenceId, completed_at: new Date().toISOString() },
    { onConflict: "user_id,sentence_id" },
  );

  if (error) return { error: "Gagal menyimpan progres kalimat." };
  return { success: true };
}

export async function deleteLesson(lessonId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Anda harus masuk untuk menghapus pelajaran." };
  }

  // Ensure the user owns the lesson before deleting.
  const { data: lesson, error: fetchError } = await supabase
    .from("lesson")
    .select("user_id")
    .eq("id", lessonId)
    .single();

  if (fetchError || !lesson) {
    return { error: "Pelajaran tidak ditemukan." };
  }

  if (lesson.user_id !== user.id) {
    return { error: "Anda tidak berwenang untuk menghapus pelajaran ini." };
  }

  const { error: deleteError } = await supabase
    .from("lesson")
    .delete()
    .eq("id", lessonId);

  if (deleteError) {
    return { error: "Gagal menghapus pelajaran." };
  }

  revalidatePath("/lessons");
  redirect("/lessons");
}
