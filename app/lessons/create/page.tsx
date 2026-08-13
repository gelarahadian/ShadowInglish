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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createLesson } from "../actions";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { parseTimestampedTranscript } from "@/lib/transcript";
import { AudioUploadForm } from "@/features/auth/components/audio-upload-form";

const manualFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z.string().optional(),
  sentences: z.string().min(10, "Please provide at least one sentence."),
});

const youtubeFormSchema = z.object({
  url: z.string().url("Enter a valid YouTube URL."),
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z.string().optional(),
  sentences: z.array(
    z.object({
      text: z.string().min(1, "Sentence text is required."),
      start_time: z.coerce.number().min(0, "Start time cannot be negative."),
      end_time: z.coerce.number().min(0, "End time cannot be negative."),
    }),
  ).min(1, "Add at least one sentence."),
});

type YouTubeSentence = z.infer<typeof youtubeFormSchema>["sentences"][number];

function ErrorAlert({ error }: { error: string | null }) {
  if (!error) return null;

  return (
    <Alert variant="destructive">
      <Terminal className="h-4 w-4" />
      <AlertTitle>Heads up!</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
}

function ManualCreateForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof manualFormSchema>>({
    resolver: zodResolver(manualFormSchema),
    defaultValues: { title: "", description: "", sentences: "" },
  });

  async function onSubmit(values: z.infer<typeof manualFormSchema>) {
    setError(null);
    startTransition(async () => {
      const result = await createLesson(values);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <ErrorAlert error={error} />
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem><FormLabel>Title</FormLabel><FormControl><Input placeholder="e.g., Business English - Unit 1" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="A short description of the lesson." {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="sentences" render={({ field }) => (
          <FormItem><FormLabel>Sentences</FormLabel><FormControl><Textarea placeholder="Enter each sentence on a new line." rows={10} {...field} /></FormControl><FormDescription>Each line will be treated as a separate sentence.</FormDescription><FormMessage /></FormItem>
        )} />
        <Button type="submit" disabled={isPending}>{isPending ? "Creating..." : "Create Lesson Manually"}</Button>
      </form>
    </Form>
  );
}

function YouTubeCreateForm() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [sentences, setSentences] = useState<YouTubeSentence[]>([]);
  const form = useForm<Omit<z.infer<typeof youtubeFormSchema>, "sentences">>({
    resolver: zodResolver(youtubeFormSchema.omit({ sentences: true })),
    defaultValues: { url: "", title: "", description: "" },
  });

  function handleParseTranscript() {
    const parsedSentences = parseTimestampedTranscript(transcript);
    if (parsedSentences.length === 0) {
      setError("No timestamped sentences were found. Use YouTube timestamps such as 0:00, or paste SRT/WebVTT subtitles.");
      return;
    }

    setError(null);
    setSentences(parsedSentences);
  }

  async function onSubmit(values: Omit<z.infer<typeof youtubeFormSchema>, "sentences">) {
    setError(null);
    const parsedSentences = sentences.length > 0 ? sentences : parseTimestampedTranscript(transcript);
    if (parsedSentences.length === 0) {
      setError("Paste a timestamped transcript using timestamps such as 0:00, or paste SRT/WebVTT subtitles.");
      return;
    }

    setSentences(parsedSentences);
    const validation = youtubeFormSchema.safeParse({ ...values, sentences: parsedSentences });
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Please check the sentence timestamps.");
      return;
    }

    setIsPending(true);
    try {
      const response = await fetch("/api/import-youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not create YouTube lesson.");
      router.push(`/lessons/${result.lessonId}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not create YouTube lesson.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <ErrorAlert error={error} />
        <Alert>
          <AlertTitle>YouTube embed lesson</AlertTitle>
          <AlertDescription>
            The video stays on YouTube. Add transcript text and timestamps you are authorized to use; this app does not download or transcribe YouTube media.
          </AlertDescription>
        </Alert>
        <FormField control={form.control} name="url" render={({ field }) => (
          <FormItem>
            <FormLabel>YouTube URL</FormLabel>
            <FormControl><Input placeholder="https://www.youtube.com/watch?v=..." {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="space-y-3 rounded-lg border p-4">
          <div>
            <h3 className="font-medium">Paste timestamped transcript</h3>
            <p className="text-sm text-muted-foreground">Supports copied YouTube timestamps such as 0:18 or 0.18, plus SRT and WebVTT. The final timestamped line receives a five-second default duration.</p>
          </div>
          <Textarea
            aria-label="Timestamped transcript"
            placeholder={"0.18 Accent and your pronunciation.\n0.21 It will also be clear, slow English.\n0.25 So watch the whole video."}
            rows={8}
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
          />
          <Button type="button" variant="secondary" onClick={handleParseTranscript}>Parse transcript</Button>
        </div>
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem><FormLabel>Lesson title</FormLabel><FormControl><Input placeholder="e.g., TED Talk: The Power of Practice" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="A short description of the lesson." {...field} /></FormControl><FormMessage /></FormItem>
        )} />

        <Button type="submit" disabled={isPending}>{isPending ? "Creating..." : "Create YouTube Lesson"}</Button>
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
          <CardDescription>Choose a method to create your new shadowing lesson.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="youtube" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="youtube">YouTube Embed</TabsTrigger>
              <TabsTrigger value="upload">Upload Audio</TabsTrigger>
              <TabsTrigger value="manual">Create Manually</TabsTrigger>
            </TabsList>
            <TabsContent value="youtube" className="mt-6"><YouTubeCreateForm key="youtube" /></TabsContent>
            <TabsContent value="upload" className="mt-6"><p className="text-sm text-gray-500 mb-4">Upload file audio Anda, AI akan men-transkrip dan menyiapkan audionya secara otomatis.</p><AudioUploadForm key="upload" /></TabsContent>
            <TabsContent value="manual" className="mt-6"><p className="text-sm text-gray-500 mb-4">Membuat pelajaran tanpa AI, Anda memasukkan teks secara manual.</p><ManualCreateForm key="manual" /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
