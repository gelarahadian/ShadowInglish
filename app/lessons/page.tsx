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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Lesson } from "@/types/lesson";

function LessonGrid({ lessons }: { lessons: Lesson[] | null }) {
  if (!lessons || lessons.length === 0) {
    return <p className="text-gray-500 mt-4">No lessons found in this category.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {lessons.map((lesson) => (
        <Link href={`/lessons/${lesson.id}`} key={lesson.id} className="block hover:scale-105 transition-transform duration-200">
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

  const { data: { user } } = await supabase.auth.getUser();

  // Fetch official lessons and my lessons in parallel
  const [officialLessonsResponse, myLessonsResponse] = await Promise.all([
    supabase.from("lesson").select().is("user_id", null),
    user ? supabase.from("lesson").select().eq("user_id", user.id) : Promise.resolve({ data: null, error: null })
  ]);

  const officialLessons = officialLessonsResponse.data;
  const myLessons = myLessonsResponse.data;

  return (
    <div className="bg-white">
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Lessons</h1>
          <Link href="/lessons/create">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Create New Lesson
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="official" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="official">Official</TabsTrigger>
            <TabsTrigger value="my-lessons">My Lessons</TabsTrigger>
          </TabsList>
          <TabsContent value="official" className="mt-6">
            <LessonGrid lessons={officialLessons} />
          </TabsContent>
          <TabsContent value="my-lessons" className="mt-6">
            {user ? (
              <LessonGrid lessons={myLessons} />
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">You must be logged in to view your lessons.</p>
                <Button asChild className="mt-4">
                  <Link href="/login">Login</Link>
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
