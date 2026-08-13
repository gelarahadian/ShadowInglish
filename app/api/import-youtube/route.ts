import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
  url: z.string().url({ message: "Invalid URL format." }).refine(
    (url) => getYouTubeVideoId(url) !== null,
    { message: "URL is not a valid YouTube video." },
  ),
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(200),
  description: z.string().trim().max(500).optional(),
  sentences: z
    .array(
      z.object({
        text: z.string().trim().min(1, "Sentence text is required.").max(1_000),
        start_time: z.coerce.number().min(0, "Start time cannot be negative."),
        end_time: z.coerce.number().min(0, "End time cannot be negative."),
      }),
    )
    .min(1, "Add at least one sentence.")
    .superRefine((sentences, context) => {
      sentences.forEach((sentence, index) => {
        if (sentence.end_time <= sentence.start_time) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "End time must be later than the start time.",
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
      { error: "You must be logged in to import lessons." },
      { status: 401 },
    );
  }

  try {
    const validation = importSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Invalid lesson data." },
        { status: 400 },
      );
    }

    const { url, title, description, sentences } = validation.data;
    const videoId = getYouTubeVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: "URL is not a valid YouTube video." }, { status: 400 });
    }

    const embedUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const { data: lessonData, error: lessonError } = await supabase
      .from("lesson")
      .insert({
        title,
        description: description || "YouTube embed lesson",
        video_url: embedUrl,
        user_id: user.id,
      })
      .select("id")
      .single();

    if (lessonError || !lessonData) {
      throw new Error(`Could not save lesson to database: ${lessonError?.message ?? "Unknown error"}`);
    }

    const { error: sentencesError } = await supabase.from("sentence").insert(
      sentences.map((sentence, index) => ({
        lesson_id: lessonData.id,
        text: sentence.text,
        order: index,
        start_time: sentence.start_time,
        end_time: sentence.end_time,
      })),
    );

    if (sentencesError) {
      await supabase.from("lesson").delete().eq("id", lessonData.id);
      throw new Error(`Could not save sentences: ${sentencesError.message}`);
    }

    return NextResponse.json({
      message: "YouTube lesson created successfully!",
      lessonId: lessonData.id,
    });
  } catch (error) {
    console.error("Error in /api/import-youtube:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred." },
      { status: 500 },
    );
  }
}
