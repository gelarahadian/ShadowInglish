import { createClient } from "@/lib/supabase/server";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Lesson, Sentence } from "@/types/lesson";
import LessonPlayer from "./lesson-player";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params

  const supabase = await createClient();

  const { data: lesson } = await supabase
    .from("lesson")
    .select("*")
    .eq("id", await id)
    .single();

  const { data: sentences } = await supabase
    .from("sentence")
    .select("*")
    .eq("lesson_id", await id)
    .order("order", { ascending: true });

  const { data: vocabulary } = await supabase
    .from("vocabulary_items")
    .select("word, meaning, pronunciation")
    .eq("lesson_id", id);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: completedSentences } = user
    ? await supabase
      .from("user_sentence_progress")
      .select("sentence_id")
      .eq("user_id", user.id)
      .in("sentence_id", (sentences ?? []).map((sentence) => sentence.id))
    : { data: [] };

  const { data: shadowingResults } = user
    ? await supabase
      .from("shadowing_results")
      .select("sentence_id, score, transcribed_text, created_at")
      .eq("user_id", user.id)
      .in("sentence_id", (sentences ?? []).map((s) => s.id))
    : { data: [] };

  const latestResults = new Map<string, { score: number; transcribedText: string }>();
  if (shadowingResults) {
    const sortedResults = shadowingResults.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    for (const result of sortedResults) {
      if (!latestResults.has(result.sentence_id)) {
        latestResults.set(result.sentence_id, { score: result.score, transcribedText: result.transcribed_text ?? "" });
      }
    }
  }

  const initialResults: { [key: string]: { score: number; transcribedText: string } } = {};
  latestResults.forEach((value, key) => {
    initialResults[key] = value;
  });

  if (!lesson) {
    return <div>Lesson not found.</div>;
  }

  const lessonWithSentences: Lesson = {
    ...lesson,
    sentences: (sentences as Sentence[]) ?? [],
    vocabulary: vocabulary ?? [],
  };

  return <LessonPlayer lesson={lessonWithSentences} completedSentenceIds={completedSentences?.map((progress) => progress.sentence_id) ?? []} initialResults={initialResults} />;
}