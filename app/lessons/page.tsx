import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { Lesson } from "@/types/lesson";

function LessonGrid({ lessons }: { lessons: Lesson[] | null }) {
  if (!lessons || lessons.length === 0) {
    return <p>No lessons found.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {lessons.map((lesson) => (
        <Link href={`/lessons/${lesson.id}`} key={lesson.id}>
          <Card>
            <CardHeader>
              <CardTitle>{lesson.title}</CardTitle>
              <CardDescription>{lesson.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge>{lesson.level}</Badge>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export default async function LessonsPage() {
  const supabase = await createClient();

  const { data: officialLessons } = await supabase
    .from("lesson")
    .select();

  return (
    <div className="bg-white dark:bg-black">
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Official Lessons</h1>
          <Link href="/lessons/create">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Create New Lesson
            </Button>
          </Link>
        </div>
        <LessonGrid lessons={officialLessons} />
      </div>
    </div>
  );
}
