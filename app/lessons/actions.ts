"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { parseTimestampedTranscript } from "@/lib/transcript";

const formSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  sentences: z.string().min(1),
});

export async function createLesson(values: z.infer<typeof formSchema>) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Anda harus masuk untuk membuat pelajaran." };
  }

  const sentences = parseTimestampedTranscript(values.sentences);
  console.log("Parsed sentences:", sentences);
  if (sentences.length === 0) {
    return { error: "Tidak ada kalimat valid yang ditemukan. Pastikan untuk menyertakan timestamp untuk pembuatan manual." };
  }

  // 1. Insert the lesson and get its ID
  const { data: lessonData, error: lessonError } = await supabase
    .from("lesson")
    .insert({
      title: values.title,
      description: values.description,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (lessonError || !lessonData) {
    console.error("Error creating lesson:", lessonError);
    return { error: "Gagal membuat pelajaran." };
  }

  const lessonId = lessonData.id;

  // 2. Prepare and insert the sentences
  const sentencesToInsert = sentences.map((sentence, index) => ({
    lesson_id: lessonId,
    text: sentence.text,
    order: index,
    start_time: sentence.start_time,
    end_time: sentence.end_time,
  }));

  const { error: sentencesError } = await supabase
    .from("sentence")
    .insert(sentencesToInsert);

  if (sentencesError) {
    console.error("Error creating sentences:", sentencesError);
    // TODO: Delete the lesson that was just created to avoid orphaned lessons.
    await supabase.from("lesson").delete().eq("id", lessonId);
    return { error: "Gagal menyimpan kalimat." };
  }

  // 3. Revalidate paths and redirect
  revalidatePath("/lessons");
  redirect(`/lessons/${lessonId}`);
}
