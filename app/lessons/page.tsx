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

export default async function LessonsPage() {
  const supabase = await createClient();
  const { data: lessons } = await supabase.from("lesson").select();

  return (
    <div className="bg-white dark:bg-black">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-8">Official Lessons</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {lessons?.map((lesson) => (
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
      </div>
    </div>
  );
}
