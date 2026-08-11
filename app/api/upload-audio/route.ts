import { NextResponse } from 'next/server';
import { AssemblyAI } from 'assemblyai';
import { createClient } from '@/lib/supabase/server';

const assemblyai = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY as string,
});

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'You must be logged in to upload lessons.' }, { status: 401 });
  if (!process.env.ASSEMBLYAI_API_KEY) return NextResponse.json({ error: 'Transcription service is not configured.' }, { status: 500 });

  try {
    const formData = await request.formData();
    const file = formData.get('audio') as File;
    const title = formData.get('title') as string;

    if (!file) return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });

    // Convert File to Buffer for AssemblyAI
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Transcribe with AssemblyAI
    console.log('Starting AssemblyAI transcription for uploaded file...');
    const transcript = await assemblyai.transcripts.transcribe({
      audio: buffer,
      speaker_labels: false,
    });

    if (transcript.status === 'error') throw new Error(`Transcription failed: ${transcript.error}`);
    if (!(transcript as any).sentences || (transcript as any).sentences.length === 0) throw new Error('Could not extract any sentences from the audio.');

    // 2. Save lesson to Supabase
    const { data: lessonData, error: lessonError } = await supabase
      .from('lesson')
      .insert({
        title: title || file.name,
        description: 'Imported from uploaded audio',
        level: 'Beginner',
        user_id: user.id,
      })
      .select()
      .single();

    if (lessonError) throw new Error(`Could not save lesson to database: ${lessonError.message}`);

    // 3. Prepare and save sentences
    const sentencesToInsert = (transcript as any).sentences.map((sentence: any, index: number) => ({
      lesson_id: lessonData.id,
      text: sentence.text,
      order: index,
      start_time: sentence.start / 1000,
      end_time: sentence.end / 1000,
    }));

    const { error: sentencesError } = await supabase.from('sentence').insert(sentencesToInsert);
    if (sentencesError) throw new Error(`Lesson was created, but failed to save sentences: ${sentencesError.message}`);

    return NextResponse.json({ message: "Lesson created successfully!", lessonId: lessonData.id });

  } catch (error: any) {
    console.error('Error in /api/upload-audio:', error);
    return NextResponse.json({ error: error.message || 'An unknown error occurred.' }, { status: 500 });
  }
}
