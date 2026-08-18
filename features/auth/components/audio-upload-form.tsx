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
import { useState, useTransition } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Loader2 } from "lucide-react";
import { useRouter } from 'next/navigation';

const uploadFormSchema = z.object({
  title: z.string().min(3, "Judul minimal 3 karakter."),
  audio: z.any().refine((files) => files?.length > 0, "Silakan unggah file audio."),
});

export function AudioUploadForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const form = useForm<z.infer<typeof uploadFormSchema>>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      title: "",
    },
  });

  async function onSubmit(values: z.infer<typeof uploadFormSchema>) {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append('title', values.title);
      formData.append('audio', values.audio[0]);

      const response = await fetch('/api/upload-audio', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Gagal mengunggah audio.');
      } else if (result?.lessonId) {
        router.push(`/lessons/${result.lessonId}`);
      } else {
        setError('Terjadi galat yang tidak terduga.');
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {error && (
          <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Galat</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Judul Pelajaran</FormLabel>
              <FormControl>
                <Input placeholder="Masukkan judul pelajaran" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="audio"
          render={({ field: { onChange, value, ...field } }) => (
            <FormItem>
              <FormLabel>File Audio</FormLabel>
              <FormControl>
                <Input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => onChange(e.target.files)}
                  {...field}
                />
              </FormControl>
              <FormDescription>Unggah file audio (.mp3, .wav).</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Mengunggah &amp; Mentranskripsi... (Mohon tunggu, ini butuh 5-10 menit)
            </>
          ) : (
            "Unggah dan Buat Pelajaran"
          )}
        </Button>
      </form>
    </Form>
  );
}
