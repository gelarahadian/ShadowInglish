export type Sentence = {
  id: string;
  lesson_id: string;
  text: string;
  translation: string | null; // Added translation
  order: number;
  start_time: number | null;
  end_time: number | null;
  created_at: string;
};

export type VocabularyItem = {
  word: string;
  meaning: string;
  pronunciation: string | null;
};

export type Lesson = {
  id: string;
  created_at: string;
  title: string;
  description: string | null;
  video_url: string | null;
  level: string | null;
  sentences: Sentence[];
  vocabulary: VocabularyItem[]; // Added vocabulary
  shadowing_tips: string | null;
};
