import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchTranscript } from "youtube-transcript";
import {
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
} from "youtube-transcript";
import { createClient } from "@/lib/supabase/server";
import { parseTimestampedTranscript, segmentTranscript, TranscriptEntry } from "@/lib/transcript";
import { correctSentences } from "@/lib/correction";
import {
  YoutubeTranscriptNotAvailableLanguageError,
} from "youtube-transcript";

const ENGLISH_LANG_PREFERENCES = ["en", "en-US", "en-GB", "en-orig"];

async function fetchTranscriptPreferringEnglish(videoId: string): Promise<TranscriptEntry[]> {
  for (const lang of ENGLISH_LANG_PREFERENCES) {
    try {
      return (await fetchTranscript(videoId, { lang })) as TranscriptEntry[];
    } catch (error) {
      if (error instanceof YoutubeTranscriptNotAvailableLanguageError) continue;
      throw error;
    }
  }
  return (await fetchTranscript(videoId)) as TranscriptEntry[];
}

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

function formatTimestamp(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const rest = wholeSeconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Anda harus masuk untuk menggunakan transkrip." },
      { status: 401 },
    );
  }
  return null;
}

// GET /api/transcript?url=<youtube-url>
// Auto-extracts the (auto-generated) transcript of a YouTube video, segments
// it into sentences, and corrects spelling errors so it is safe for shadowing.
export async function GET(request: NextRequest) {
  const authError = await requireUser();
  if (authError) return authError;

  const url = request.nextUrl.searchParams.get("url") ?? "";
  const validation = z.string().url().safeParse(url);
  if (!validation.success) {
    return NextResponse.json({ error: "URL YouTube tidak valid." }, { status: 400 });
  }

  const videoId = getYouTubeVideoId(url);
  if (!videoId) {
    return NextResponse.json({ error: "URL bukan video YouTube yang valid." }, { status: 400 });
  }

  try {
    const entries = await fetchTranscriptPreferringEnglish(videoId);
    if (entries.length === 0) {
      return NextResponse.json(
        { error: "Transkrip tidak ditemukan untuk video ini. Coba metode manual di bawah." },
        { status: 404 },
      );
    }

    const sentences = segmentTranscript(entries);
    const { correctedTexts, correctedCount } = await correctSentences(sentences);
    const correctedSentences = sentences.map((sentence, index) => ({
      ...sentence,
      text: correctedTexts[index] ?? sentence.text,
    }));

    const transcriptText = correctedSentences
      .map(
        (sentence) =>
          `${formatTimestamp(sentence.start_time)} ${sentence.text}`,
      )
      .join("\n");

    return NextResponse.json({
      sentences: correctedSentences,
      transcript: transcriptText,
      correctedCount,
    });
  } catch (error) {
    if (error instanceof YoutubeTranscriptVideoUnavailableError) {
      return NextResponse.json({ error: "Video tidak tersedia atau tidak bisa diakses." }, { status: 404 });
    }
    if (error instanceof YoutubeTranscriptTooManyRequestError) {
      return NextResponse.json({ error: "Terlalu banyak permintaan ke YouTube. Tunggu sebentar lalu coba lagi." }, { status: 429 });
    }
    if (error instanceof YoutubeTranscriptDisabledError || error instanceof YoutubeTranscriptNotAvailableError) {
      return NextResponse.json(
        { error: "Transkrip tidak tersedia untuk video ini. Gunakan metode manual di bawah." },
        { status: 404 },
      );
    }
    console.error("Error fetching YouTube transcript:", error);
    return NextResponse.json(
      { error: "Gagal mengambil transkrip. Gunakan metode manual di bawah." },
      { status: 500 },
    );
  }
}

// POST /api/transcript { text }
// Parses a pasted timestamped transcript and corrects spelling errors.
const transcriptSchema = z.object({
  text: z.string().min(1, "Transkrip kosong."),
});

export async function POST(request: Request) {
  const authError = await requireUser();
  if (authError) return authError;

  try {
    const validation = transcriptSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Data transkrip tidak valid." },
        { status: 400 },
      );
    }

    const sentences = parseTimestampedTranscript(validation.data.text);
    if (sentences.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada kalimat bertimestamp yang ditemukan. Gunakan timestamp YouTube seperti 0:18, atau tempel SRT/WebVTT." },
        { status: 400 },
      );
    }

    const { correctedTexts, correctedCount } = await correctSentences(sentences);
    const correctedSentences = sentences.map((sentence, index) => ({
      ...sentence,
      text: correctedTexts[index] ?? sentence.text,
    }));

    const transcriptText = correctedSentences
      .map((sentence) => `${formatTimestamp(sentence.start_time)} ${sentence.text}`)
      .join("\n");

    return NextResponse.json({
      sentences: correctedSentences,
      transcript: transcriptText,
      correctedCount,
    });
  } catch (error) {
    console.error("Error correcting transcript:", error);
    return NextResponse.json(
      { error: "Gagal mengoreksi transkrip." },
      { status: 500 },
    );
  }
}
