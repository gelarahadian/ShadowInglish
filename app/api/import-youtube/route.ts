import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { applyLocalFixes } from "@/lib/correction";

function getYouTubeVideoId(url: string) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();

    if (hostname === "youtu.be") {
      return parsedUrl.pathname.split("/").filter(Boolean)[0] ?? null;
    }

    if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      if (parsedUrl.pathname === "/watch") {
        return parsedUrl.searchParams.get("v");
      }

      const [resource, videoId] = parsedUrl.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(resource)) {
        return videoId ?? null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

const importSchema = z.object({
  url: z.string().url({ message: "Format URL tidak valid." }).refine(
    (url) => getYouTubeVideoId(url) !== null,
    { message: "URL bukan video YouTube yang valid." },
  ),
  title: z.string().trim().min(3, "Judul minimal 3 karakter.").max(200),
  description: z.string().trim().max(500).optional(),
  sentences: z
    .array(
      z.object({
        text: z.string().trim().min(1, "Teks kalimat wajib diisi.").max(1_000),
        start_time: z.coerce.number().min(0, "Waktu mulai tidak boleh negatif."),
        end_time: z.coerce.number().min(0, "Waktu akhir tidak boleh negatif."),
      }),
    )
    .min(1, "Tambahkan minimal satu kalimat.")
    .superRefine((sentences, context) => {
      sentences.forEach((sentence, index) => {
        if (sentence.end_time <= sentence.start_time) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Waktu akhir harus lebih besar dari waktu mulai.",
            path: [index, "end_time"],
          });
        }
      });
    }),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Anda harus masuk untuk mengimpor pelajaran." },
      { status: 401 },
    );
  }

  try {
    const validation = importSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Data pelajaran tidak valid." },
        { status: 400 },
      );
    }

    const { url, title, description, sentences } = validation.data;
    const videoId = getYouTubeVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: "URL bukan video YouTube yang valid." }, { status: 400 });
    }

    const embedUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const { data: lessonData, error: lessonError } = await supabase
      .from("lesson")
      .insert({
        title,
        description: description || "Pelajaran embed YouTube",
        video_url: embedUrl,
        user_id: user.id,
      })
      .select("id")
      .single();

    if (lessonError || !lessonData) {
      throw new Error(`Gagal menyimpan pelajaran ke database: ${lessonError?.message ?? "Galat tidak diketahui"}`);
    }

    const { error: sentencesError } = await supabase.from("sentence").insert(
      sentences.map((sentence, index) => ({
        lesson_id: lessonData.id,
        text: applyLocalFixes(sentence.text),
        order: index,
        start_time: sentence.start_time,
        end_time: sentence.end_time,
      })),
    );

    if (sentencesError) {
      await supabase.from("lesson").delete().eq("id", lessonData.id);
      throw new Error(`Gagal menyimpan kalimat: ${sentencesError.message}`);
    }

    return NextResponse.json({
      message: "Pelajaran YouTube berhasil dibuat!",
      lessonId: lessonData.id,
    });
  } catch (error) {
    console.error("Error in /api/import-youtube:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Terjadi galat yang tidak diketahui." },
      { status: 500 },
    );
  }
}
