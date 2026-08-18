"use client";

import { useEffect, useRef, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lesson } from "@/types/lesson";
import { completeSentence, deleteLesson } from "./actions";
import {
  CircleCheck,
  Lock,
  Mic,
  Play,
  StopCircle,
  Trash2,
} from "lucide-react";

type YouTubePlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setPlaybackRate: (suggestedRate: number) => void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        options: {
          videoId: string;
          playerVars?: Record<string, number>;
          events?: { onReady?: () => void };
        },
      ) => YouTubePlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

function getYouTubeVideoId(url: string | null) {
  if (!url) return null;

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
    if (hostname === "youtu.be") {
      return parsedUrl.pathname.split("/").filter(Boolean)[0] ?? null;
    }
    if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      if (parsedUrl.pathname === "/watch") return parsedUrl.searchParams.get("v");
      const [resource, videoId] = parsedUrl.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(resource)) return videoId ?? null;
    }
  } catch {
    return null;
  }

  return null;
}

function loadYouTubePlayerApi() {
  if (window.YT?.Player) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });
}

type TranscriptionResult = { text: string; score: number };

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

type ScoreColor = "red" | "yellow" | "green" | "blue" | "gray";
type ScoreRange = { label: string; color: ScoreColor };

function getScoreRange(score: number): ScoreRange {
  if (score >= 100) return { label: "Perfect", color: "blue" };
  if (score >= 71) return { label: "Bagus", color: "green" };
  if (score >= 51) return { label: "Cukup", color: "yellow" };
  if (score >= 0) return { label: "Kurang", color: "red" };
  return { label: "---", color: "gray" };
}

const SCORE_BADGE_CLASSES: Record<ScoreColor, string> = {
  red: "border-red-300 bg-red-100 text-red-700",
  yellow: "border-yellow-300 bg-yellow-100 text-yellow-800",
  green: "border-green-300 bg-green-100 text-green-700",
  blue: "border-blue-300 bg-blue-100 text-blue-700",
  gray: "border-gray-200 bg-gray-100 text-gray-500",
};

const MIN_PASS_SCORE = 51;
const MIN_COMPLETE_SCORE = 71;

const formatRecordingTime = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export default function LessonPlayer({
  lesson,
  completedSentenceIds,
  initialResults,
}: {
  lesson: Lesson;
  completedSentenceIds: string[];
  initialResults: { [key: string]: { score: number; transcribedText: string } };
}) {
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [completedSentenceIdSet, setCompletedSentenceIdSet] = useState(() => new Set(completedSentenceIds));
  const [passedSentenceIdSet, setPassedSentenceIdSet] = useState(() => {
    const passed = new Set<string>();
    for (const [sentenceId, result] of Object.entries(initialResults)) {
      if (result.score >= MIN_PASS_SCORE) passed.add(sentenceId);
    }
    return passed;
  });
  const [speed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcriptionResults, setTranscriptionResults] = useState<{ [key: string]: TranscriptionResult | null }>({});
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [scoredSentenceIds, setScoredSentenceIds] = useState(() => new Set<string>(Object.keys(initialResults)));
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const stopTimeRef = useRef<number | null>(null);
  const stopCheckRef = useRef<number | null>(null);
  const recordTimeoutRef = useRef<number | null>(null);
  const autoCompleteRequestedRef = useRef<Set<string>>(new Set());
  const videoId = getYouTubeVideoId(lesson.video_url);
  const activeSentence = lesson.sentences[currentSentenceIndex];

  const handleDelete = async () => {
    if (!lesson.user_id) {
      alert("Pelajaran resmi tidak dapat dihapus.");
      return;
    }
    const confirmed = window.confirm(
      "Yakin ingin menghapus pelajaran ini? Tindakan ini tidak dapat dibatalkan."
    );
    if (confirmed) {
      const result = await deleteLesson(lesson.id);
      if (result?.error) {
        alert(result.error);
      }
    }
  };

  const currentTranscriptionResult = transcriptionResults[activeSentence?.id] ?? (activeSentence?.id ? (initialResults[activeSentence.id] ? { text: initialResults[activeSentence.id].transcribedText, score: initialResults[activeSentence.id].score } : null) : null);

  const isSentenceUnlocked = (index: number) => {
    if (index === 0) return true;
    const previousSentence = lesson.sentences[index - 1];
    return completedSentenceIdSet.has(previousSentence.id) || passedSentenceIdSet.has(previousSentence.id);
  };

  const clearStopCheck = () => {
    if (stopCheckRef.current !== null) {
      window.clearInterval(stopCheckRef.current);
      stopCheckRef.current = null;
    }
    stopTimeRef.current = null;
  };

  const clearRecordTimeout = () => {
    if (recordTimeoutRef.current !== null) {
      window.clearTimeout(recordTimeoutRef.current);
      recordTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    if (!videoId) return;

    let isDisposed = false;
    loadYouTubePlayerApi().then(() => {
      if (isDisposed || !window.YT?.Player) return;
      youtubePlayerRef.current = new window.YT.Player("youtube-player", {
        videoId,
        playerVars: { playsinline: 1, rel: 0 },
        events: { onReady: () => youtubePlayerRef.current?.setPlaybackRate(speed) },
      });
    });

    return () => {
      isDisposed = true;
      clearStopCheck();
      youtubePlayerRef.current?.destroy();
      youtubePlayerRef.current = null;
    };
  }, [videoId, speed]);

  useEffect(
    () => () => {
      clearStopCheck();
      clearRecordTimeout();
      const recorder = mediaRecorderRef.current;
      mediaRecorderRef.current = null;
      recorder?.stream?.getTracks?.()?.forEach((track) => track.stop());
    },
    []
  );

  useEffect(() => {
    if (!isRecording) return;
    setRecordingSeconds(0);
    const interval = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(interval);
  }, [isRecording]);

  const playUntilSentenceEnd = () => {
    const stopTime = activeSentence?.end_time;
    if (stopTime === null || stopTime === undefined) return;

    clearStopCheck();
    stopTimeRef.current = stopTime;
    stopCheckRef.current = window.setInterval(() => {
      const youtubePlayer = youtubePlayerRef.current;
      const audioPlayer = audioPlayerRef.current;
      const currentTime = youtubePlayer?.getCurrentTime() ?? audioPlayer?.currentTime;
      if (currentTime !== undefined && currentTime >= stopTimeRef.current!) {
        youtubePlayer?.pauseVideo();
        audioPlayer?.pause();
        clearStopCheck();
        setIsPlaying(false);
      }
    }, 100);
  };

  const handlePlayModelAudio = () => {
    if (!activeSentence) return;

    if (videoId && youtubePlayerRef.current) {
      youtubePlayerRef.current.seekTo(activeSentence.start_time ?? 0, true);
      youtubePlayerRef.current.setPlaybackRate(speed);
      youtubePlayerRef.current.playVideo();
      playUntilSentenceEnd();
      setIsPlaying(true);
      return;
    }

    const audio = audioPlayerRef.current;
    if (audio) {
      audio.currentTime = activeSentence.start_time ?? 0;
      audio.play().catch((error) => console.error("Error playing:", error));
      playUntilSentenceEnd();
      setIsPlaying(true);
      return;
    }

    if (window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(activeSentence.text);
      utterance.rate = speed;
      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSelectSentence = (index: number) => {
    const sentence = lesson.sentences[index];
    setCurrentSentenceIndex(index);
    clearStopCheck();
    youtubePlayerRef.current?.pauseVideo();
    youtubePlayerRef.current?.seekTo(sentence?.start_time ?? 0, true);
    audioPlayerRef.current?.pause();
    if (audioPlayerRef.current) {
      audioPlayerRef.current.currentTime = sentence?.start_time ?? 0;
    }
    setIsPlaying(false);
  };

  const handleCompleteSentence = async (): Promise<boolean> => {
    if (!activeSentence || !scoredSentenceIds.has(activeSentence.id) || completedSentenceIdSet.has(activeSentence.id)) return false;

    const result = await completeSentence(activeSentence.id);

    if (result?.error) {
      alert(result.error);
      return false;
    }

    setCompletedSentenceIdSet((current) => new Set(current).add(activeSentence.id));
    if (currentSentenceIndex < lesson.sentences.length - 1) {
      setCurrentSentenceIndex(currentSentenceIndex + 1);
    }
    return true;
  };

  // Auto-complete: a fresh recording that scores Bagus (>= 71) or Perfect
  // marks the sentence complete and advances to the next one automatically.
  useEffect(() => {
    const sentenceId = activeSentence?.id;
    const freshResult = sentenceId ? transcriptionResults[sentenceId] : undefined;
    if (!sentenceId || !freshResult || freshResult.score < MIN_COMPLETE_SCORE) return;
    if (completedSentenceIdSet.has(sentenceId)) return;
    if (autoCompleteRequestedRef.current.has(sentenceId)) return;

    autoCompleteRequestedRef.current.add(sentenceId);
    void handleCompleteSentence().then((completed) => {
      if (!completed) autoCompleteRequestedRef.current.delete(sentenceId);
    });
  });

  const handleRecord = async () => {
    if (isRecording) {
      clearRecordTimeout();
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => chunks.push(event.data);
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        void transcribeAudio(new Blob(chunks, { type: "audio/wav" }));
      };
      mediaRecorder.start();
      setIsRecording(true);
      // A previously-started recording's timer would otherwise stop this one.
      clearRecordTimeout();
      // Listen-once + repeat headroom; floor 15s so short sentences don't cut off mid-speech.
      const sentenceDuration = activeSentence?.end_time ?? null;
      const sentenceStart = activeSentence?.start_time ?? null;
      const autoStopDelay =
        sentenceDuration !== null && sentenceStart !== null
          ? Math.max(15_000, (sentenceDuration - sentenceStart) * 1000 + 15_000)
          : 15_000;
      recordTimeoutRef.current = window.setTimeout(() => {
        recordTimeoutRef.current = null;
        if (mediaRecorder.state === "recording") {
          mediaRecorder.stop();
          setIsRecording(false);
        }
      }, autoStopDelay);
    } catch (error) {
      console.error("Could not get media devices.", error);
      alert("Tidak dapat mengakses mikrofon Anda. Periksa izin browser Anda.");
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    if (!activeSentence) return;

    setIsTranscribing(true);
    setTranscriptionResults(prev => ({ ...prev, [activeSentence.id]: null }));
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.wav");
    formData.append("originalText", activeSentence.text);
    formData.append("sentenceId", activeSentence.id);

    try {
      const response = await fetch("/api/transcribe", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Transkripsi gagal.");
      setTranscriptionResults(prev => ({ ...prev, [activeSentence.id]: { text: result.transcribedText, score: result.score } }));
      setScoredSentenceIds((current) => new Set(current).add(activeSentence.id));
      if (result.score >= MIN_PASS_SCORE) {
        setPassedSentenceIdSet((current) => new Set(current).add(activeSentence.id));
      }
    } catch (error) {
      console.error("Error calling transcription API:", error);
      setTranscriptionResults(prev => ({
        ...prev,
        [activeSentence.id]: {
          text: `Error: ${error instanceof Error ? error.message : "Transkripsi gagal."}`,
          score: 0,
        }
      }));
    } finally {
      setIsTranscribing(false);
    }
  };

  const activeScoreRange = currentTranscriptionResult ? getScoreRange(currentTranscriptionResult.score) : null;
  const activeIsCompleted = completedSentenceIdSet.has(activeSentence?.id ?? "");

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between">
        <h1 className="mb-2 text-2xl font-bold">Beranda &gt; Pelajaran Terbaru &gt; {lesson.title} &gt; Pelajaran Shadowing</h1>
        {lesson.user_id && (
          <Button variant="destructive" onClick={handleDelete} className="flex items-center gap-2">
            <Trash2 size={16} /> Hapus Pelajaran
          </Button>
        )}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          {videoId ? (
            <div className="aspect-video overflow-hidden rounded-lg">
              <div id="youtube-player" className="h-full w-full" />
            </div>
          ) : lesson.video_url ? (
            <div className="flex items-center justify-center rounded-lg p-2">
              <audio ref={audioPlayerRef} controls className="w-full" onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}>
                <source src={lesson.video_url} type="audio/mpeg" />
                Browser Anda tidak mendukung elemen audio.
              </audio>
            </div>
          ) : null}

          <div className="mt-6">
            <h2 className="mb-2 text-lg font-semibold">Kalimat</h2>
            <div className="max-h-[500px] space-y-2 overflow-y-auto pr-2">
              {lesson.sentences.map((sentence, index) => {
                  const isUnlocked = isSentenceUnlocked(index);
                  const sentenceResult = transcriptionResults[sentence.id] ?? (initialResults[sentence.id] ? { text: initialResults[sentence.id].transcribedText, score: initialResults[sentence.id].score } : null);
                  const sentenceScoreRange = sentenceResult ? getScoreRange(sentenceResult.score) : null;
                  return (
                    <div
                      key={sentence.id}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 ${
                        currentSentenceIndex === index ? "border-blue-500 bg-gray-200" : "bg-transparent"
                      } ${!isUnlocked ? "cursor-not-allowed bg-gray-100 text-gray-400" : ""}`}
                      onClick={() => isUnlocked && handleSelectSentence(index)}
                    >
                      <p className="flex flex-grow items-center gap-2 pr-4">
                        <span>{index + 1}. {sentence.text}</span>
                        {sentenceScoreRange && (
                          <Badge className={`${SCORE_BADGE_CLASSES[sentenceScoreRange.color]} flex-shrink-0`}>
                            {sentenceScoreRange.label}
                          </Badge>
                        )}
                      </p>
                      {completedSentenceIdSet.has(sentence.id) ? (
                        <CircleCheck size={18} className="flex-shrink-0 text-emerald-600" aria-label="Selesai" role="img" />
                      ) : !isUnlocked ? (
                        <Lock size={18} className="flex-shrink-0 text-gray-400" aria-label="Terkunci" role="img" />
                      ) : null}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        <div>
          <div className="rounded-lg border p-6">
            <h2 className="mb-4 text-lg font-semibold">Kalimat Aktif</h2>
            <p className="mb-4 text-3xl">{activeSentence?.text ?? "Tidak ada kalimat."}</p>
            <div className="flex flex-wrap items-center gap-4">
              <Button onClick={handlePlayModelAudio} disabled={isPlaying || !activeSentence} className="flex items-center gap-2"><Play /> Putar (Audio Model)</Button>
              <Button onClick={handleRecord} disabled={!activeSentence || isTranscribing} variant={isRecording ? "secondary" : "destructive"} className="flex items-center gap-2 border border-black"><>{isRecording ? <StopCircle /> : <Mic />}</>{isRecording ? "Hentikan Rekaman" : isTranscribing ? "Menganalisis..." : "Rekam (Shadowing Anda)"}</Button>
              {isRecording && (
                <span className="flex items-center gap-2 text-sm font-semibold text-red-600">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" aria-hidden="true" />
                  Merekam {formatRecordingTime(recordingSeconds)}
                </span>
              )}
              {activeIsCompleted && (
                <Badge className="flex items-center gap-1 border-emerald-300 bg-emerald-100 text-emerald-700">
                  <CircleCheck size={14} /> Selesai
                </Badge>
              )}
            </div>

            {!scoredSentenceIds.has(activeSentence?.id ?? "") && !isTranscribing && <p className="mt-3 text-sm text-muted-foreground">Rekam kalimat ini untuk mendapatkan skor. Skor Cukup (51+) membuka kalimat berikutnya, Bagus (71+) menyelesaikannya secara otomatis.</p>}
            {(isTranscribing || currentTranscriptionResult) && <div className="mt-4 border-t pt-4"><h3 className="mb-2 text-base font-semibold">Hasil Anda</h3>{isTranscribing ? <p>Menganalisis audio Anda, mohon tunggu...</p> : currentTranscriptionResult && <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-lg"><span className="font-bold">Skor:</span> {currentTranscriptionResult.score}/100</p>
                {activeScoreRange && <Badge className={SCORE_BADGE_CLASSES[activeScoreRange.color]}>{activeScoreRange.label}</Badge>}
              </div>
              <p className="mt-2"><span className="font-bold">Yang Anda ucapkan:</span> {currentTranscriptionResult.text}</p>
              {activeScoreRange?.color === "red" && <p className="mt-2 text-sm text-red-600">Skor masih kurang. Rekam ulang untuk membuka kalimat berikutnya (minimal Cukup / 51).</p>}
              {activeScoreRange?.color === "yellow" && <p className="mt-2 text-sm text-yellow-700">Kalimat berikutnya sudah terbuka. Rekam ulang untuk skor Bagus (71+) agar kalimat otomatis selesai.</p>}
              {activeScoreRange?.color === "green" && <p className="mt-2 text-sm text-green-700">Bagus! Kalimat otomatis ditandai selesai dan kalimat berikutnya terbuka.</p>}
              {activeScoreRange?.color === "blue" && <p className="mt-2 text-sm text-blue-700">Sempurna! Skor 100.</p>}
            </div>}</div>}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <Accordion type="single" collapsible>
          {activeSentence?.translation && (
            <AccordionItem value="item-1">
              <AccordionTrigger>Terjemahan</AccordionTrigger>
              <AccordionContent>{activeSentence.translation}</AccordionContent>
            </AccordionItem>
          )}
          {lesson.vocabulary && lesson.vocabulary.length > 0 && (
            <AccordionItem value="item-2">
              <AccordionTrigger>Kosakata</AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2">
                  {lesson.vocabulary.map((item, index) => (
                    <li key={index}>
                      <strong className="font-semibold">{item.word}</strong>: {item.meaning}
                      {item.pronunciation && <span className="ml-2 text-sm text-gray-500">[{item.pronunciation}]</span>}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}
          {lesson.shadowing_tips && (
            <AccordionItem value="item-3">
              <AccordionTrigger>Tips Shadowing</AccordionTrigger>
              <AccordionContent>{lesson.shadowing_tips}</AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </div>
    </div>
  );
}
