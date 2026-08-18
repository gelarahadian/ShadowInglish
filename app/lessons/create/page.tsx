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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { createLesson } from "../actions";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Sparkles, Terminal } from "lucide-react";
import { parseTimestampedTranscript } from "@/lib/transcript";
import { AudioUploadForm } from "@/features/auth/components/audio-upload-form";

const manualFormSchema = z.object({
  title: z.string().min(3, "Judul minimal 3 karakter."),
  description: z.string().optional(),
  sentences: z.string().min(10, "Berikan minimal satu kalimat."),
});

const youtubeFormSchema = z.object({
  url: z.string().url("Masukkan URL YouTube yang valid."),
  title: z.string().min(3, "Judul minimal 3 karakter."),
  description: z.string().optional(),
  sentences: z.array(
    z.object({
      text: z.string().min(1, "Teks kalimat wajib diisi."),
      start_time: z.coerce.number().min(0, "Waktu mulai tidak boleh negatif."),
      end_time: z.coerce.number().min(0, "Waktu akhir tidak boleh negatif."),
    }),
  ).min(1, "Tambahkan minimal satu kalimat."),
});

type YouTubeSentence = z.infer<typeof youtubeFormSchema>["sentences"][number];

function ErrorAlert({ error }: { error: string | null }) {
  if (!error) return null;

  return (
    <Alert variant="destructive">
      <Terminal className="h-4 w-4" />
      <AlertTitle>Perhatian!</AlertTitle>
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
          <FormItem><FormLabel>Judul</FormLabel><FormControl><Input placeholder="Misalnya: Business English - Unit 1" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem><FormLabel>Deskripsi</FormLabel><FormControl><Textarea placeholder="Deskripsi singkat pelajaran." {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="sentences" render={({ field }) => (
          <FormItem><FormLabel>Kalimat</FormLabel><FormControl><Textarea placeholder="Masukkan setiap kalimat pada baris baru." rows={10} {...field} /></FormControl><FormDescription>Setiap baris akan dianggap sebagai satu kalimat.</FormDescription><FormMessage /></FormItem>
        )} />
        <Button type="submit" disabled={isPending}>{isPending ? "Membuat..." : "Buat Pelajaran Secara Manual"}</Button>
      </form>
    </Form>
  );
}

function TranscriptGuide() {
  const steps = [
    "Buka video di YouTube di browser (Chrome/Edge/Safari).",
    "Klik tombol \u201cLainnya\u201d (ikon tiga titik \u2022\u2022\u2022) di bawah judul video.",
    "Pilih \u201cTampilkan transkrip\u201d (Show transcript). Panel transkrip muncul di sisi kanan.",
    "Di panel transkrip, klik menu bahasa di bagian atas dan pilih \u201cBahasa Inggris\u201d (pilih \u201cInggris (Dibuat otomatis)\u201d jika transkrip manual tidak tersedia).",
    "Aktifkan tombol \u201cTimestamps\u201d / \u201cWaktu\u201d di bagian atas panel agar setiap baris menampilkan timestamp seperti 0:18.",
    "Klik di dalam panel transkrip, tekan Ctrl+A (Windows) atau Cmd+A (Mac) untuk memilih semua teks, lalu Ctrl+C atau Cmd+C untuk menyalin.",
    "Tempel teks di kolom di bawah, lalu klik \u201cParse & Koreksi Transkrip\u201d \u2014 teks otomatis dikoreksi ejaannya sebelum menjadi kalimat shadowing.",
  ];

  return (
    <Accordion type="single" collapsible className="rounded-lg border p-4">
      <AccordionItem value="guide" className="border-b-0">
        <AccordionTrigger className="text-sm font-medium">
          Cara mengambil transkrip YouTube secara manual (langkah demi langkah)
        </AccordionTrigger>
        <AccordionContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            {steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
          <p className="mt-3 rounded-md bg-muted p-3 text-xs">
            Tips: format yang didukung adalah timestamp YouTube (0:18), SRT, dan WebVTT.
            Jika ekstraksi otomatis gagal (misalnya video tidak menyediakan transkrip),
            cara manual di atas selalu bisa dipakai sebagai cadangan.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function YouTubeCreateForm() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [sentences, setSentences] = useState<YouTubeSentence[]>([]);
  const [correctedCount, setCorrectedCount] = useState(0);
  const form = useForm<Omit<z.infer<typeof youtubeFormSchema>, "sentences">>({
    resolver: zodResolver(youtubeFormSchema.omit({ sentences: true })),
    defaultValues: { url: "", title: "", description: "" },
  });

  async function handleAutoExtract() {
    const url = form.getValues("url");
    if (!url.trim()) {
      setError("Masukkan URL YouTube terlebih dahulu.");
      return;
    }

    setError(null);
    setCorrectedCount(0);
    setIsExtracting(true);
    try {
      const response = await fetch(`/api/transcript?url=${encodeURIComponent(url)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Gagal mengambil transkrip.");
      setSentences(result.sentences);
      setTranscript(result.transcript);
      setCorrectedCount(result.correctedCount ?? 0);
    } catch (extractError) {
      setError(extractError instanceof Error ? extractError.message : "Gagal mengambil transkrip.");
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleParseTranscript() {
    if (!transcript.trim()) {
      setError("Tempel transkrip bertimestamp terlebih dahulu.");
      return;
    }

    setError(null);
    setCorrectedCount(0);
    setIsParsing(true);
    try {
      const response = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Gagal memproses transkrip.");

      setSentences(result.sentences);
      setTranscript(result.transcript);
      setCorrectedCount(result.correctedCount ?? 0);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Gagal memproses transkrip.");
    } finally {
      setIsParsing(false);
    }
  }

  async function onSubmit(values: Omit<z.infer<typeof youtubeFormSchema>, "sentences">) {
    setError(null);
    const parsedSentences = sentences.length > 0 ? sentences : parseTimestampedTranscript(transcript);
    if (parsedSentences.length === 0) {
      setError("Tempel transkrip bertimestamp menggunakan format seperti 0:00, atau tempel subtitle SRT/WebVTT.");
      return;
    }

    setSentences(parsedSentences);
    const validation = youtubeFormSchema.safeParse({ ...values, sentences: parsedSentences });
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Periksa timestamp kalimat.");
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
      if (!response.ok) throw new Error(result.error ?? "Gagal membuat pelajaran YouTube.");
      router.push(`/lessons/${result.lessonId}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Gagal membuat pelajaran YouTube.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <ErrorAlert error={error} />
        <Alert>
          <AlertTitle>Pelajaran dari video YouTube</AlertTitle>
          <AlertDescription>
            Transkrip diambil otomatis dari YouTube (atau ditempel manual), lalu ejaannya
            dikoreksi otomatis agar yang kamu shadowing selalu kata/kalimat yang benar.
            Aplikasi hanya menampilkan embed video dan transkrip — tidak mengunduh media YouTube.
          </AlertDescription>
        </Alert>
        <FormField control={form.control} name="url" render={({ field }) => (
          <FormItem>
            <FormLabel>YouTube URL</FormLabel>
            <div className="flex flex-wrap items-start gap-2">
              <FormControl>
                <Input placeholder="https://www.youtube.com/watch?v=..." {...field} />
              </FormControl>
              <Button type="button" variant="secondary" onClick={handleAutoExtract} disabled={isExtracting} className="flex items-center gap-2">
                {isExtracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isExtracting ? "Mengambil transkrip..." : "Ambil Transkrip Otomatis"}
              </Button>
            </div>
            <FormMessage />
          </FormItem>
        )} />
        <div className="space-y-3 rounded-lg border p-4">
          <div>
            <h3 className="font-medium">Tempel transkrip bertimestamp</h3>
            <p className="text-sm text-muted-foreground">Cadangan jika auto extract gagal. Mendukung timestamp YouTube seperti 0:18 atau 0.18, serta SRT dan WebVTT. Baris timestamp terakhir mendapat durasi default lima detik.</p>
          </div>
          <Textarea
            aria-label="Transkrip bertimestamp"
            placeholder={"0.18 Accent and your pronunciation.\n0.21 It will also be clear, slow English.\n0.25 So watch the whole video."}
            rows={8}
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
          />
          <Button type="button" variant="secondary" onClick={handleParseTranscript} disabled={isParsing} className="flex items-center gap-2">
            {isParsing && <Loader2 className="h-4 w-4 animate-spin" />}
            {isParsing ? "Mengoreksi..." : "Parse & Koreksi Transkrip"}
          </Button>
          <TranscriptGuide />
        </div>

        {sentences.length > 0 && (
          <div className="space-y-2 rounded-lg border p-4">
            <h4 className="font-medium">
              {sentences.length} kalimat terdeteksi
              {correctedCount > 0 && <span className="ml-2 text-sm text-emerald-600">{correctedCount} kata dikoreksi otomatis</span>}
            </h4>
            <div className="max-h-48 space-y-1 overflow-y-auto pr-2 text-sm">
              {sentences.map((sentence, index) => (
                <p key={index} className="flex gap-2">
                  <span className="flex-shrink-0 font-mono text-muted-foreground">
                    {Math.floor(sentence.start_time / 60)}:{String(Math.round(sentence.start_time % 60)).padStart(2, "0")}
                  </span>
                  <span>{sentence.text}</span>
                </p>
              ))}
            </div>
          </div>
        )}

        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem><FormLabel>Judul Pelajaran</FormLabel><FormControl><Input placeholder="Misalnya: TED Talk: The Power of Practice" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem><FormLabel>Deskripsi</FormLabel><FormControl><Textarea placeholder="Deskripsi singkat pelajaran." {...field} /></FormControl><FormMessage /></FormItem>
        )} />

        <Button type="submit" disabled={isPending}>{isPending ? "Membuat..." : "Buat Pelajaran YouTube"}</Button>
      </form>
    </Form>
  );
}

export default function CreateLessonPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Buat Pelajaran Baru</CardTitle>
          <CardDescription>Pilih metode untuk membuat pelajaran shadowing baru Anda.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="youtube" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="youtube">Embed YouTube</TabsTrigger>
              <TabsTrigger value="upload">Unggah Audio</TabsTrigger>
              <TabsTrigger value="manual">Buat Manual</TabsTrigger>
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
