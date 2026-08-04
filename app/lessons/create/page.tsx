"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createLesson } from "../actions";
import { useState, useTransition } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Loader2 } from "lucide-react";
import { useRouter } from 'next/navigation';

// Schema for manual form
const manualFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z.string().optional(),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]),
  sentences: z.string().min(10, "Please provide at least one sentence."),
});

// Schema for YouTube import form
const youtubeFormSchema = z.object({
  youtubeUrl: z.string().url({ message: "Please enter a valid YouTube URL." })
    .refine(url => url.includes('youtube.com') || url.includes('youtu.be'), {
      message: "URL must be from YouTube.",
    }),
});

function ManualCreateForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof manualFormSchema>>({
    resolver: zodResolver(manualFormSchema),
    defaultValues: {
      title: "",
      description: "",
      level: "Beginner",
      sentences: "",
    },
  });

  async function onSubmit(values: z.infer<typeof manualFormSchema>) {
    setError(null);
    startTransition(async () => {
      const result = await createLesson(values);
      if (result?.error) {
        setError(result.error);
      }
      // TODO: Handle successful creation (e.g., show success message, redirect)
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {error && (
          <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Heads up!</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Business English - Unit 1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="A short description of the lesson." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="level"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Level</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a level" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Beginner">Beginner</SelectItem>
                  <SelectItem value="Intermediate">Intermediate</SelectItem>
                  <SelectItem value="Advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sentences"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sentences</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter each sentence on a new line."
                  rows={10}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Each line will be treated as a separate sentence.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create Lesson Manually"}
        </Button>
      </form>
    </Form>
  );
}

function YouTubeImportForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const form = useForm<z.infer<typeof youtubeFormSchema>>({
    resolver: zodResolver(youtubeFormSchema),
    defaultValues: {
      youtubeUrl: "",
    },
  });

  async function onSubmit(values: z.infer<typeof youtubeFormSchema>) {
    setError(null);
    startTransition(async () => {
      console.log("Submitting URL:", values.youtubeUrl);
      // Placeholder for future API call
      // const result = await importFromYouTube(values.youtubeUrl);
      // if (result?.error) {
      //   setError(result.error);
      // } else if (result?.lessonId) {
      //   router.push(`/lessons/${result.lessonId}`);
      // }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log("Simulated import successful.");
      // On success, you would typically redirect, e.g.:
      // router.push('/lessons/some-new-id');
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {error && (
          <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <FormField
          control={form.control}
          name="youtubeUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>YouTube URL</FormLabel>
              <FormControl>
                <Input placeholder="https://www.youtube.com/watch?v=..." {...field} />
              </FormControl>
              <FormDescription>
                Paste a YouTube video URL to automatically generate a lesson.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            "Import from YouTube"
          )}
        </Button>
      </form>
    </Form>
  );
}

export default function CreateLessonPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Create a New Lesson</CardTitle>
          <CardDescription>
            Choose a method to create your new shadowing lesson.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="youtube" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="youtube">Import from YouTube</TabsTrigger>
              <TabsTrigger value="manual">Create Manually</TabsTrigger>
            </TabsList>
            <TabsContent value="youtube" className="mt-6">
              <YouTubeImportForm />
            </TabsContent>
            <TabsContent value="manual" className="mt-6">
              <ManualCreateForm />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
