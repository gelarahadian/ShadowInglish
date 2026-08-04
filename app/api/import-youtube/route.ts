import { NextResponse } from 'next/server';
import { z } from 'zod';
import ytdl from 'ytdl-core';
import { AssemblyAI } from 'assemblyai';
import { createClient } from '@/lib/supabase/server';

const importSchema = z.object({
  url: z.string().url({ message: "Invalid URL format." })
    .refine(url => ytdl.validateURL(url), {
      message: "URL is not a valid YouTube video.",
    }),
});

const assemblyai = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY as string,
});

export async function POST(request: Request) {
  const supabase = await createClient();

  // Check for auth and API keys
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'You must be logged in to import lessons.' }, { status: 401 });
  }
  if (!process.env.ASSEMBLYAI_API_KEY) {
    return NextResponse.json({ error: 'Transcription service is not configured.' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const validation = importSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.flatten().fieldErrors.url?.[0] }, { status: 400 });
    }

    const { url } = validation.data;
    console.log(`Processing YouTube URL: ${url}`);

    // 1. Get video info and audio stream
    const videoInfo = await ytdl.getInfo(url);
    const audioStream = ytdl(url, {
      quality: 'highestaudio',
      filter: 'audioonly',
    });

    // 2. Transcribe with AssemblyAI
    const transcript = await assemblyai.transcripts.transcribe({
      audio: audioStream,
      speaker_labels: false, // We don't need speaker labels for this
    });

    if (transcript.status === 'error') {
      throw new Error(`Transcription failed: ${transcript.error}`);
    }
    if (!(transcript as any).sentences || (transcript as any).sentences.length === 0) {
      throw new Error('Could not extract any sentences from the video.');
    }

    // 3. Save lesson to Supabase
    const { data: lessonData, error: lessonError } = await supabase
      .from('lesson')
      .insert({
        title: videoInfo.videoDetails.title,
        description: videoInfo.videoDetails.description?.slice(0, 100) + '...' || 'Imported from YouTube',
        video_url: url,
        level: 'Beginner', // Default level, can be changed by user later
        user_id: user.id, // Associate with the current user
      })
      .select()
      .single();

    if (lessonError) {
      throw new Error(`Could not save lesson to database: ${lessonError.message}`);
    }

    // 4. Prepare and save sentences
    const sentencesToInsert = (transcript as any).sentences.map((sentence: any, index: number) => ({
      lesson_id: lessonData.id,
      text: sentence.text,
      order: index,
      start_time: sentence.start / 1000, // Convert ms to seconds
      end_time: sentence.end / 1000,     // Convert ms to seconds
    }));

    const { error: sentencesError } = await supabase
      .from('sentence')
      .insert(sentencesToInsert);

    if (sentencesError) {
      // If sentences fail, we should probably roll back the lesson creation,
      // but for now, we'll just log the error.
      console.error(`Failed to save sentences for lesson ${lessonData.id}:`, sentencesError);
      throw new Error(`Lesson was created, but failed to save sentences: ${sentencesError.message}`);
    }

    // 5. Return the new lesson ID
    return NextResponse.json({
      message: "Lesson created successfully!",
      lessonId: lessonData.id
    });

  } catch (error: any) {
    console.error('Error in /api/import-youtube:', error);
    return NextResponse.json({ error: error.message || 'An unknown error occurred.' }, { status: 500 });
  }
}
