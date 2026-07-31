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

  if (!lesson) {
    return <div>Lesson not found.</div>;
  }

  const lessonWithSentences: Lesson = {
    ...lesson,
    sentences: (sentences as Sentence[]) ?? [],
  };

  const firstSentence = lessonWithSentences.sentences.find(
    (s: any) => s.order === 1
  );

  return <LessonPlayer lesson={lessonWithSentences} />;
}