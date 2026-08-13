import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const officialLessons = [
  {
    title: "First Step Shadowing",
    description: "Build confidence with short, clear sentences for your first shadowing practice.",
    level: "Beginner",
    shadowing_tips: "Listen to one sentence first. Then play it again and speak at the same time as the model. Focus on clear words instead of speed. Repeat each sentence three times, and record yourself when you feel ready.",
    vocabulary: [
      { word: "practise", meaning: "to do an activity repeatedly to improve", pronunciation: "/ˈpræk.tɪs/" },
      { word: "regular", meaning: "happening often and at a consistent time", pronunciation: "/ˈreɡ.jə.lər/" },
      { word: "sentence", meaning: "a group of words that expresses a complete idea", pronunciation: "/ˈsen.təns/" },
    ],
    sentences: [
      { text: "Hello, how are you today?", translation: "Halo, apa kabarmu hari ini?" },
      { text: "I am doing well, thank you.", translation: "Saya baik, terima kasih." },
      { text: "My name is Maya.", translation: "Nama saya Maya." },
      { text: "It is nice to meet you.", translation: "Senang bertemu denganmu." },
      { text: "I am learning English every day.", translation: "Saya belajar bahasa Inggris setiap hari." },
      { text: "Please speak slowly.", translation: "Tolong berbicara pelan-pelan." },
      { text: "Could you say that again?", translation: "Bisakah kamu mengatakannya lagi?" },
      { text: "I understand a little.", translation: "Saya sedikit mengerti." },
      { text: "Let us practise one sentence at a time.", translation: "Mari berlatih satu kalimat pada satu waktu." },
      { text: "I can improve with regular practice.", translation: "Saya bisa berkembang dengan latihan rutin." },
      { text: "That sounds good to me.", translation: "Itu terdengar bagus bagi saya." },
      { text: "Thank you for your help today.", translation: "Terima kasih atas bantuanmu hari ini." },
    ],
  },
  {
    title: "Common English Phrases",
    description: "Practise useful everyday phrases for common conversations and errands.",
    level: "Beginner",
    shadowing_tips: "Practise each phrase as one complete unit. Use a friendly, polite tone for requests and questions. Keep the important words clear, then repeat until the phrase feels natural enough to use in daily life.",
    vocabulary: [
      { word: "nearest", meaning: "the closest in distance", pronunciation: "/ˈnɪr.ɪst/" },
      { word: "by card", meaning: "using a bank or payment card", pronunciation: "/baɪ kɑːrd/" },
      { word: "would like", meaning: "a polite way to ask for something", pronunciation: "/wʊd laɪk/" },
      { word: "excuse me", meaning: "a polite phrase used to get attention", pronunciation: "/ɪkˈskjuːz miː/" },
    ],
    sentences: [
      { text: "Excuse me, could you help me?", translation: "Permisi, bisakah Anda membantu saya?" },
      { text: "Where is the nearest bus stop?", translation: "Di mana halte bus terdekat?" },
      { text: "How much does this cost?", translation: "Berapa harga ini?" },
      { text: "I would like a glass of water, please.", translation: "Saya ingin segelas air, tolong." },
      { text: "Can I pay by card?", translation: "Bisakah saya membayar dengan kartu?" },
      { text: "What time does the store close?", translation: "Jam berapa toko ini tutup?" },
      { text: "I am looking for the train station.", translation: "Saya sedang mencari stasiun kereta." },
      { text: "Could I have the menu, please?", translation: "Bolehkah saya minta menunya?" },
      { text: "I do not understand this word.", translation: "Saya tidak mengerti kata ini." },
      { text: "Would you mind taking a photo for me?", translation: "Apakah Anda keberatan mengambil foto untuk saya?" },
      { text: "That is exactly what I need.", translation: "Itu persis yang saya butuhkan." },
      { text: "Have a great day.", translation: "Semoga harimu menyenangkan." },
    ],
  },
  {
    title: "Mastering the Art of Small Talk",
    description: "Keep everyday conversations moving naturally with friendly follow-up questions and responses.",
    level: "Intermediate",
    shadowing_tips: "Notice the rising tone in friendly questions and stress the important content words, such as weekend, city, project, and weather. Make short grammar words softer. Add a natural pause before a follow-up question, and aim to sound curious rather than memorised.",
    vocabulary: [
      { word: "neighbourhood", meaning: "the area around where someone lives or works", pronunciation: "/ˈneɪ.bər.hʊd/" },
      { word: "unpredictable", meaning: "likely to change unexpectedly", pronunciation: "/ˌʌn.prɪˈdɪk.tə.bəl/" },
      { word: "rewarding", meaning: "giving satisfaction because it is worthwhile", pronunciation: "/rɪˈwɔːr.dɪŋ/" },
      { word: "catch up", meaning: "to talk with someone and share recent news", pronunciation: "/kætʃ ʌp/" },
    ],
    sentences: [
      { text: "Have you been to this part of the city before?", translation: "Apakah kamu pernah ke bagian kota ini sebelumnya?" },
      { text: "I have heard great things about this neighbourhood.", translation: "Saya sering mendengar hal-hal bagus tentang lingkungan ini." },
      { text: "What do you usually like to do at weekends?", translation: "Apa yang biasanya kamu suka lakukan di akhir pekan?" },
      { text: "That sounds like a relaxing way to spend the day.", translation: "Itu terdengar seperti cara yang santai untuk menghabiskan hari." },
      { text: "How did you get interested in that?", translation: "Bagaimana kamu mulai tertarik pada hal itu?" },
      { text: "I have been trying to make more time for reading lately.", translation: "Akhir-akhir ini saya berusaha meluangkan lebih banyak waktu untuk membaca." },
      { text: "The weather has been surprisingly unpredictable this week.", translation: "Cuaca minggu ini ternyata sangat tidak menentu." },
      { text: "I hope the rain clears up before the weekend.", translation: "Saya harap hujannya reda sebelum akhir pekan." },
      { text: "What has been keeping you busy recently?", translation: "Apa yang membuatmu sibuk belakangan ini?" },
      { text: "I have been working on a project that is both challenging and rewarding.", translation: "Saya sedang mengerjakan proyek yang menantang sekaligus memuaskan." },
      { text: "It was lovely talking with you.", translation: "Senang sekali mengobrol denganmu." },
      { text: "Let us catch up again sometime soon.", translation: "Mari mengobrol lagi kapan-kapan dalam waktu dekat." },
    ],
  },
  {
    title: "Advanced Pronunciation Techniques",
    description: "Refine rhythm, stress, linking, and intonation through focused advanced shadowing practice.",
    level: "Advanced",
    shadowing_tips: "Identify the main stressed word in every sentence. Link final consonants to following vowels, and reduce unstressed function words such as to, and, can, and have. Use falling intonation for complete statements. When reviewing a recording, compare rhythm, pauses, and intonation as well as individual sounds.",
    vocabulary: [
      { word: "word stress", meaning: "stronger emphasis placed on one syllable or word", pronunciation: "/wɜːrd stres/" },
      { word: "intonation", meaning: "the rise and fall of the voice while speaking", pronunciation: "/ˌɪn.təˈneɪ.ʃən/" },
      { word: "connected speech", meaning: "words linked together in natural, fluent speech", pronunciation: "/kəˈnek.tɪd spiːtʃ/" },
      { word: "unstressed syllable", meaning: "a syllable pronounced more weakly than the stressed syllable", pronunciation: "/ʌnˈstrest ˈsɪl.ə.bəl/" },
      { word: "reduction", meaning: "shortening or weakening a sound in fast natural speech", pronunciation: "/rɪˈdʌk.ʃən/" },
    ],
    sentences: [
      { text: "Meaning often changes when the main stress shifts from one word to another.", translation: "Makna sering berubah ketika penekanan utama berpindah dari satu kata ke kata lain." },
      { text: "In connected speech, native speakers frequently link consonant sounds to following vowels.", translation: "Dalam ujaran tersambung, penutur asli sering menghubungkan bunyi konsonan dengan vokal berikutnya." },
      { text: "Try to keep the unstressed syllables short, light, and less prominent.", translation: "Cobalah menjaga suku kata tanpa tekanan tetap singkat, ringan, dan kurang menonjol." },
      { text: "A falling intonation pattern can make a statement sound complete and confident.", translation: "Pola intonasi menurun dapat membuat pernyataan terdengar lengkap dan percaya diri." },
      { text: "A rising tone may signal uncertainty, interest, or a polite invitation to continue.", translation: "Nada menaik dapat menandakan ketidakpastian, minat, atau ajakan sopan untuk melanjutkan." },
      { text: "Listen for the rhythm of thought groups rather than pronouncing every word in isolation.", translation: "Dengarkan ritme kelompok makna, bukan mengucapkan setiap kata secara terpisah." },
      { text: "The phrase could have been is often reduced in rapid, natural conversation.", translation: "Frasa could have been sering direduksi dalam percakapan alami yang cepat." },
      { text: "Precise articulation should support clarity without making the delivery sound mechanical.", translation: "Artikulasi yang tepat harus mendukung kejelasan tanpa membuat penyampaian terdengar kaku." },
      { text: "Record yourself and compare the placement of stress with the original speaker.", translation: "Rekam diri Anda dan bandingkan letak tekanan dengan penutur asli." },
      { text: "Pause deliberately between ideas so your listener can follow the structure of your message.", translation: "Berhentilah secara sengaja di antara gagasan agar pendengar dapat mengikuti struktur pesan Anda." },
      { text: "Aim for a flexible, expressive voice instead of copying an accent word for word.", translation: "Usahakan suara yang fleksibel dan ekspresif, bukan meniru aksen kata demi kata." },
      { text: "Consistent feedback and focused repetition turn difficult sounds into reliable habits.", translation: "Umpan balik yang konsisten dan pengulangan terarah mengubah bunyi sulit menjadi kebiasaan yang andal." },
    ],
  },
];

async function seed() {
  const { error: deleteError } = await supabase
    .from("lesson")
    .delete()
    .is("user_id", null);

  if (deleteError) {
    throw new Error(`Could not remove existing official lessons: ${deleteError.message}`);
  }

  for (const lesson of officialLessons) {
    const { data: lessonData, error: lessonError } = await supabase
      .from("lesson")
      .insert({
        title: lesson.title,
        description: lesson.description,
        level: lesson.level,
        shadowing_tips: lesson.shadowing_tips,
        user_id: null,
      })
      .select("id")
      .single();

    if (lessonError || !lessonData) {
      throw new Error(`Could not insert ${lesson.title}: ${lessonError?.message ?? "Unknown error"}`);
    }

    const { error: sentencesError } = await supabase.from("sentence").insert(
      lesson.sentences.map((sentence, index) => ({
        lesson_id: lessonData.id,
        text: sentence.text,
        translation: sentence.translation,
        order: index,
      })),
    );

    if (sentencesError) {
      throw new Error(`Could not insert sentences for ${lesson.title}: ${sentencesError.message}`);
    }

    const { error: vocabularyError } = await supabase.from("vocabulary_items").insert(
      lesson.vocabulary.map((item) => ({
        lesson_id: lessonData.id,
        word: item.word,
        meaning: item.meaning,
        pronunciation: item.pronunciation,
      })),
    );

    if (vocabularyError) {
      throw new Error(`Could not insert vocabulary for ${lesson.title}: ${vocabularyError.message}`);
    }
  }

  console.log(`Seeded ${officialLessons.length} official lessons.`);
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
