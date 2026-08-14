"use client";

import { useEffect, useRef, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Lesson } from "@/types/lesson";
import { completeSentence, deleteLesson } from "./actions";
import {
  Check,
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
  const [isCompleting, setIsCompleting] = useState(false);
  const [speed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptionResults, setTranscriptionResults] = useState<{ [key: string]: TranscriptionResult | null }>({});
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [scoredSentenceIds, setScoredSentenceIds] = useState(() => new Set<string>(Object.keys(initialResults)));
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const stopTimeRef = useRef<number | null>(null);
  const stopCheckRef = useRef<number | null>(null);
  const videoId = getYouTubeVideoId(lesson.video_url);
  const activeSentence = lesson.sentences[currentSentenceIndex];

  console.log("Lesson sentences:", lesson.sentences);

  const handleDelete = async () => {
    if (!lesson.user_id) {
      alert("Official lessons cannot be deleted.");
      return;
    }
    const confirmed = window.confirm(
      "Are you sure you want to delete this lesson? This action cannot be undone."
    );
    if (confirmed) {
      const result = await deleteLesson(lesson.id);
      if (result?.error) {
        alert(result.error);
      }
    }
  };

  const currentTranscriptionResult = transcriptionResults[activeSentence?.id] ?? (activeSentence?.id ? (initialResults[activeSentence.id] ? { text: initialResults[activeSentence.id].transcribedText, score: initialResults[activeSentence.id].score } : null) : null);

  const getScoreRange = (score: number) => {
    if (score >= 71) return { label: "Bagus", color: "green" };
    if (score >= 51) return { label: "Cukup", color: "yellow" };
    if (score >= 0) return { label: "Kurang", color: "red" };
    return { label: "---", color: "gray" };
  };

  const shouldAutoComplete = !currentTranscriptionResult?.score || currentTranscriptionResult?.score >= 71;



  const clearStopCheck = () => {
    if (stopCheckRef.current !== null) {
      window.clearInterval(stopCheckRef.current);
      stopCheckRef.current = null;
    }
    stopTimeRef.current = null;

  useEffect(() => {
    if (shouldAutoComplete && currentTranscriptionResult?.score !== undefined && currentTranscriptionResult?.score >= 71 && !completedSentenceIdSet.has(activeSentence?.id ?? "")) {
      handleCompleteSentence();
    }
  }, [shouldAutoComplete, currentTranscriptionResult?.score, completedSentenceIdSet, activeSentence?.id, handleCompleteSentence]);
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

  useEffect(() => () => clearStopCheck(), []);

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

  const handleCompleteSentence = async () => {
    if (!activeSentence || !scoredSentenceIds.has(activeSentence.id) || completedSentenceIdSet.has(activeSentence.id)) return;

    setIsCompleting(true);
    const result = await completeSentence(activeSentence.id);
    setIsCompleting(false);

    if (result?.error) {
      alert(result.error);
      return;
    }

    setCompletedSentenceIdSet((current) => new Set(current).add(activeSentence.id));
    if (currentSentenceIndex < lesson.sentences.length - 1) {
      setCurrentSentenceIndex(currentSentenceIndex + 1);
    }
  };

  const handleRecord = async () => {
    if (isRecording) {
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
      window.setTimeout(() => {
        if (mediaRecorder.state === "recording") mediaRecorder.stop();
      }, 10_000);
    } catch (error) {
      console.error("Could not get media devices.", error);
      alert("Could not access your microphone. Please check your browser permissions.");
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
      if (!response.ok) throw new Error(result.error || "Transcription failed.");
      setTranscriptionResults(prev => ({ ...prev, [activeSentence.id]: { text: result.transcribedText, score: result.score } }));
      setScoredSentenceIds((current) => new Set(current).add(activeSentence.id));
    } catch (error) {
      console.error("Error calling transcription API:", error);
      setTranscriptionResults(prev => ({
        ...prev,
        [activeSentence.id]: {
          text: `Error: ${error instanceof Error ? error.message : "Transcription failed."}`,
          score: 0,
        }
      }));
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between">
        <h1 className="mb-2 text-2xl font-bold">Dashboard &gt; Recent Lessons &gt; {lesson.title} &gt; Shadowing Lesson</h1>
        {lesson.user_id && (
          <Button variant="destructive" onClick={handleDelete} className="flex items-center gap-2">
            <Trash2 size={16} /> Delete Lesson
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
                Your browser does not support the audio element.
              </audio>
            </div>
          ) : null}

          <div className="mt-6">
            <h2 className="mb-2 text-lg font-semibold">Sentences</h2>
            <div className="max-h-[500px] space-y-2 overflow-y-auto pr-2">
              {lesson.sentences.map((sentence, index) => {
                  const isUnlocked = index === 0 || completedSentenceIdSet.has(lesson.sentences[index - 1]?.id);
                  return (
                    <div
                      key={sentence.id}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 ${
                        currentSentenceIndex === index ? "border-blue-500 bg-gray-200" : "bg-transparent"
                      } ${!isUnlocked ? "cursor-not-allowed bg-gray-100 text-gray-400" : ""}`}
                      onClick={() => isUnlocked && handleSelectSentence(index)}
                    >
                      <p className="flex-grow pr-4">
                        {index + 1}. {sentence.text}
                      </p>
                      {completedSentenceIdSet.has(sentence.id) ? (
                        <CircleCheck size={18} className="flex-shrink-0 text-emerald-600" aria-label="Completed" role="img" />
                      ) : !isUnlocked ? (
                        <Lock size={18} className="flex-shrink-0 text-gray-400" aria-label="Locked" role="img" />
                      ) : null}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        <div>
          <div className="rounded-lg border p-6">
            <h2 className="mb-4 text-lg font-semibold">Active Sentence</h2>
            <p className="mb-4 text-3xl">{activeSentence?.text ?? "No sentences found."}</p>
            <div className="flex flex-wrap gap-4">
              <Button onClick={handlePlayModelAudio} disabled={isPlaying || !activeSentence} className="flex items-center gap-2"><Play /> Play (Model Audio)</Button>
              <Button onClick={handleRecord} disabled={!activeSentence || isTranscribing} variant={isRecording ? "secondary" : "destructive"} className="flex items-center gap-2 border border-black"><>{isRecording ? <StopCircle /> : <Mic />}</>{isRecording ? "Stop Recording" : isTranscribing ? "Transcribing..." : "Record (Your Shadowing)"}</Button>
              <Button onClick={handleCompleteSentence} disabled={!activeSentence || !scoredSentenceIds.has(activeSentence?.id ?? "") || isCompleting || completedSentenceIdSet.has(activeSentence?.id ?? "")} className="flex items-center gap-2"><Check /> {isCompleting ? "Saving..." : completedSentenceIdSet.has(activeSentence?.id ?? "") ? "Completed" : "Mark Complete"}</Button>
            </div>

            {!scoredSentenceIds.has(activeSentence?.id ?? "") && !isTranscribing && <p className="mt-3 text-sm text-muted-foreground">Record this sentence and receive a score to unlock Mark Complete.</p>}
            {(isTranscribing || currentTranscriptionResult) && <div className="mt-4 border-t pt-4"><h3 className="mb-2 text-base font-semibold">Your Result</h3>{isTranscribing ? <p>Transcribing your audio, please wait...</p> : currentTranscriptionResult && <div><p className="text-lg"><span className="font-bold">Score:</span> {currentTranscriptionResult.score}/100</p><p className="mt-2"><span className="font-bold">What you said:</span> {currentTranscriptionResult.text}</p></div>}</div>}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <Accordion type="single" collapsible>
          {activeSentence?.translation && (
            <AccordionItem value="item-1">
              <AccordionTrigger>Translation</AccordionTrigger>
              <AccordionContent>{activeSentence.translation}</AccordionContent>
            </AccordionItem>
          )}
          {lesson.vocabulary && lesson.vocabulary.length > 0 && (
            <AccordionItem value="item-2">
              <AccordionTrigger>Vocabulary</AccordionTrigger>
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
              <AccordionTrigger>Shadowing Tips</AccordionTrigger>
              <AccordionContent>{lesson.shadowing_tips}</AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </div>
    </div>
  );
}
