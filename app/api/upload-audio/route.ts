import { NextResponse } from 'next/server';
import { AssemblyAI } from 'assemblyai';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const assemblyai = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY as string,
});

// Create a service role client for storage operations
const supabaseService = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Anda harus masuk untuk mengunggah pelajaran.' }, { status: 401 });
  if (!process.env.ASSEMBLYAI_API_KEY) return NextResponse.json({ error: 'Layanan transkripsi belum dikonfigurasi.' }, { status: 500 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Kunci peran layanan Supabase belum dikonfigurasi.' }, { status: 500 });

  try {
    const formData = await request.formData();
    const file = formData.get('audio') as File;
    const title = formData.get('title') as string;

    if (!file) return NextResponse.json({ error: 'Tidak ada file yang diunggah.' }, { status: 400 });

    // Convert File to Buffer for AssemblyAI
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Transcribe with AssemblyAI
    console.log('Starting AssemblyAI transcription for uploaded file...');
    const transcript = await assemblyai.transcripts.transcribe({
      audio: buffer,
      speaker_labels: false,
      punctuate: true,
      format_text: true,
    });

    if (transcript.status === 'error') throw new Error(`Transkripsi gagal: ${transcript.error}`);

    // Fallback: If no sentences or paragraphs, construct sentences from words
    let sentences = (transcript as any).sentences;
    if ((!sentences || sentences.length === 0)) {
      const paragraphs = (transcript as any).paragraphs;
      if (paragraphs && paragraphs.length > 0) {
        console.log('Using paragraphs as fallback...');
        sentences = paragraphs.map((p: any) => ({ text: p.text, start: p.start, end: p.end }));
      } else {
        const words = (transcript as any).words;
        if (words && words.length > 0) {
          console.log('Constructing sentences from words...');
          sentences = [];
          let currentSentence = { text: '', start: words[0].start, end: words[0].end };

          for (const word of words) {
            currentSentence.text += (currentSentence.text ? ' ' : '') + word.text;
            currentSentence.end = word.end;
            if (/[.!?]$/.test(word.text)) {
              sentences.push(currentSentence);
              currentSentence = { text: '', start: word.end, end: word.end };
            }
          }
          if (currentSentence.text) sentences.push(currentSentence);
        }
      }
    }

    if (!sentences || sentences.length === 0) {
      console.error('AssemblyAI Transcript:', JSON.stringify(transcript, null, 2));
      throw new Error('Tidak dapat mengekstrak kalimat, paragraf, atau kata dari audio.');
    }

    // 2. Upload Audio to Supabase Storage using service role
    const fileName = `${Date.now()}_${file.name.replace(/[^a-z0-9]/gi, '_')}`;
    const { data: uploadData, error: uploadError } = await supabaseService.storage
      .from('lessons')
      .upload(fileName, buffer, {
        contentType: file.type,
      });

    if (uploadError) throw new Error(`Gagal mengunggah audio ke penyimpanan: ${uploadError.message}`);

    const { data: publicUrlData } = supabaseService.storage
      .from('lessons')
      .getPublicUrl(fileName);

    // 3. Save lesson to Supabase
    const { data: lessonData, error: lessonError } = await supabase
      .from('lesson')
      .insert({
        title: title || file.name,
        description: 'Diimpor dari audio yang diunggah',
        level: 'Beginner',
        user_id: user.id,
        video_url: publicUrlData.publicUrl, // Save the audio URL here
      })
      .select()
      .single();

    if (lessonError) throw new Error(`Gagal menyimpan pelajaran ke database: ${lessonError.message}`);

    // 4. Prepare and save sentences
    const sentencesToInsert = sentences.map((sentence: any, index: number) => ({
      lesson_id: lessonData.id,
      text: sentence.text,
      order: index,
      start_time: sentence.start / 1000,
      end_time: sentence.end / 1000,
    }));

    const { error: sentencesError } = await supabase.from('sentence').insert(sentencesToInsert);
    if (sentencesError) throw new Error(`Pelajaran berhasil dibuat, tetapi gagal menyimpan kalimat: ${sentencesError.message}`);

    return NextResponse.json({ message: "Pelajaran berhasil dibuat!", lessonId: lessonData.id });

  } catch (error: any) {
    console.error('Error in /api/upload-audio:', error);
    return NextResponse.json({ error: error.message || 'Terjadi galat yang tidak diketahui.' }, { status: 500 });
  }
}

