import { NextRequest, NextResponse } from "next/server";
import { AssemblyAI } from "assemblyai";
import { createClient } from "@/lib/supabase/server";

const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY as string,
});

export async function POST(req: NextRequest) {
  if (!process.env.ASSEMBLYAI_API_KEY) {
    return NextResponse.json(
      { error: "AssemblyAI API key is not configured." },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be logged in to record shadowing." }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    const originalText = formData.get("originalText") as string;
    const sentenceId = formData.get("sentenceId") as string;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided." }, { status: 400 });
    }
    if (!originalText) {
      return NextResponse.json({ error: "No original text provided." }, { status: 400 });
    }

    // The SDK handles the upload and polling process automatically
    const transcript = await client.transcripts.transcribe({
      audio: audioFile,
    });

    if (transcript.status === "error") {
      return NextResponse.json({ error: transcript.error }, { status: 500 });
    }

    // Basic scoring logic
    const transcribedText = transcript.text || "";
    const score = calculateSimilarity(originalText, transcribedText);

    // Persist the result so the user can review their progress later
    if (sentenceId) {
      await supabase.from("shadowing_results").insert({
        user_id: user.id,
        sentence_id: sentenceId,
        transcribed_text: transcribedText,
        score,
      });
    }

    return NextResponse.json({
      transcribedText,
      score,
    });
  } catch (error) {
    console.error("Error in transcription API route:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during transcription." },
      { status: 500 },
    );
  }
}

// A more robust word-level similarity function
function calculateSimilarity(str1: string, str2: string): number {
  // Normalize strings: lowercase, remove punctuation, and split into words.
  const words1 = str1.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
  const words2 = str2.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);

  const len1 = words1.length;
  const len2 = words2.length;
  const maxLen = Math.max(len1, len2);

  if (maxLen === 0) return 100;

  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(null));

  for (let i = 0; i <= len1; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = words1[i - 1] === words2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,       // Deletion
        matrix[i][j - 1] + 1,       // Insertion
        matrix[i - 1][j - 1] + cost // Substitution
      );
    }
  }

  const distance = matrix[len1][len2];
  const similarity = ((maxLen - distance) / maxLen) * 100;
  return Math.max(0, Math.round(similarity));
}
