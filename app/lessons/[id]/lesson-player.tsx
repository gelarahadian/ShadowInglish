"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
const ReactPlayer = dynamic(() => import("react-player"), { ssr: false }) as any;
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Lesson } from "@/types/lesson";
import {
  Play,
  Pause,
  Rewind,
  FastForward,
  Mic,
  StopCircle,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";

export default function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<Record<number, 'good' | 'practice'>>({});
  const [transcriptionResult, setTranscriptionResult] = useState<{ text: string; score: number } | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const playerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleNextSentence = () => {
    if (currentSentenceIndex < lesson.sentences.length - 1) {
      setCurrentSentenceIndex(currentSentenceIndex + 1);
    }
  };

  const handlePreviousSentence = () => {
    if (currentSentenceIndex > 0) {
      setCurrentSentenceIndex(currentSentenceIndex - 1);
    }
  };

  const stopTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying && stopTimeRef.current !== null) {
      const checkTime = () => {
        // playerRef.current is the HTMLVideoElement
        if (playerRef.current && playerRef.current.currentTime >= stopTimeRef.current!) {
          // Pause the video
          playerRef.current.pause();
          setIsPlaying(false);
          stopTimeRef.current = null;
        } else if (isPlaying) {
          requestAnimationFrame(checkTime);
        }
      };
      requestAnimationFrame(checkTime);
    }
  }, [isPlaying]);

  const handlePlayModelAudio = () => {
    // 1. Check if we have an audio/video URL (from YouTube or Upload)
    if (lesson.video_url) {
      const player = playerRef.current;
      let video = player;

      // Try to find the actual HTMLVideoElement
      if (video && !(video instanceof HTMLVideoElement)) {
        if (typeof player.getInternalPlayer === "function") {
          video = player.getInternalPlayer();
        }
      }

      if (video && video instanceof HTMLVideoElement && activeSentence) {
        if (!video.src && lesson.video_url) {
          video.src = lesson.video_url;
        }

        video.volume = 1;
        video.muted = false;
        video.currentTime = activeSentence.start_time ?? 0;
        video.play().catch((e: any) => console.error("Error playing:", e));

        setIsPlaying(true);
        stopTimeRef.current = activeSentence.end_time;
        return; // Exit after playing audio/video
      }
    }

    // 2. Fallback: Use Web Speech API (TTS) for manual lessons or if video fails
    if (typeof window !== "undefined" && window.speechSynthesis) {
      console.log("Using Web Speech API (TTS) for model audio");
      const utterance = new SpeechSynthesisUtterance(activeSentence?.text ?? "");
      utterance.rate = speed;
      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
    } else {
      console.error("No audio source and TTS not supported");
    }
  };

  const handleFeedback = (status: 'good' | 'practice') => {
    setFeedbackStatus(prev => ({
      ...prev,
      [currentSentenceIndex]: status
    }));
  };

  const handleRecord = async () => {
    // Clear previous results when starting a new recording
    if (!isRecording) {
      setTranscriptionResult(null);
    }

    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();

        // Auto-stop after 10 seconds
        setTimeout(() => {
          if (mediaRecorder.state === "recording") {
            handleRecord(); // This will trigger the stop logic
          }
        }, 10000);

        const chunks: Blob[] = [];
        mediaRecorder.ondataavailable = (event) => {
          chunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(chunks, { type: "audio/wav" });
          // setAudioChunks(chunks); // Removed because audioChunks is not used elsewhere
          transcribeAudio(audioBlob);
        };

        setIsRecording(true);
      } catch (error) {
        console.error("Could not get media devices.", error);
        alert("Could not access your microphone. Please check your browser permissions.");
      }
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');
    formData.append('originalText', activeSentence?.text ?? '');

    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setTranscriptionResult({
          text: result.transcribedText,
          score: result.score,
        });
      } else {
        throw new Error(result.error || 'Transcription failed.');
      }
    } catch (error: any) {
      console.error('Error calling transcription API:', error);
      setTranscriptionResult({
        text: `Error: ${error.message}`,
        score: 0,
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const activeSentence = lesson.sentences[currentSentenceIndex];

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-2">
        Dashboard &gt; Recent Lessons &gt; {lesson.title} &gt; Shadowing Lesson
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
        {/* Left Column */}
        <div>
          {lesson.video_url && (
            <div className="aspect-video bg-gray-200 flex items-center justify-center rounded-lg">
              <ReactPlayer
                ref={playerRef as any}
                url={lesson.video_url}
                width="100%"
                height="100%"
                controls
                playing={isPlaying}
                playbackRate={speed}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            </div>
          )}
          {lesson.video_url && (
            <div className="mt-4">
              <h2 className="text-lg font-semibold mb-2">Lesson Controls</h2>
              <div className="flex items-center gap-4">
                <Button onClick={handlePreviousSentence} size="icon" aria-label="Previous Sentence">
                  <Rewind />
                </Button>
                <Button onClick={() => setIsPlaying(!isPlaying)} size="icon" aria-label="Play/Pause">
                  {isPlaying ? <Pause /> : <Play />}
                </Button>
                <Button onClick={handleNextSentence} size="icon" aria-label="Next Sentence">
                  <FastForward />
                </Button>
                <div className="flex-grow flex items-center gap-2">
                  <span>Speed</span>
                  <Slider
                    min={0.5}
                    max={2}
                    step={0.25}
                    value={[speed]}
                    onValueChange={(value) => setSpeed(value[0])}
                  />
                  <span>{speed}x</span>
                </div>
              </div>
            </div>
          )}

          {/* Sentence List */}
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-2">Sentences</h2>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {lesson.sentences.map((sentence, index) => (
                <div
                  key={sentence.id}
                  className={`p-3 rounded-lg cursor-pointer border flex justify-between items-center ${
                    currentSentenceIndex === index
                      ? "bg-gray-200 border-blue-500"
                      : "bg-transparent"
                  }`}
                  onClick={() => setCurrentSentenceIndex(index)}
                >
                  <p className="flex-grow pr-4">{index + 1}. {sentence.text}</p>
                  {feedbackStatus[index] === 'good' && <ThumbsUp size={18} className="text-green-500 flex-shrink-0" aria-label="Good" role="img" />}
                  {feedbackStatus[index] === 'practice' && <ThumbsDown size={18} className="text-red-500 flex-shrink-0" aria-label="Needs Practice" role="img" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div>
          <div className="border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Active Sentence</h2>
            <p className="text-3xl mb-4">
              {activeSentence?.text ?? "No sentences found."}
            </p>
            <div className="flex gap-4">
              <Button
                onClick={handlePlayModelAudio}
                disabled={isPlaying}
                className="flex items-center gap-2"
              >
                <Play /> Play (Model Audio)
              </Button>
              <Button
                onClick={handleRecord}
                variant={isRecording ? "secondary" : "destructive"}
                className="flex items-center gap-2 border border-black"
              >
                {isRecording ? <StopCircle /> : <Mic />}
                {isRecording ? "Stop Recording" : isTranscribing ? "Transcribing..." : "Record (Your Shadowing)"}
              </Button>
            </div>

            {(isTranscribing || transcriptionResult) && (
              <div className="mt-4 border-t pt-4">
                <h3 className="text-base font-semibold mb-2">Your Result</h3>
                {isTranscribing ? (
                  <p>Transcribing your audio, please wait...</p>
                ) : (
                  transcriptionResult && (
                    <div>
                      <p className="text-lg">
                        <span className="font-bold">Score:</span> {transcriptionResult.score}/100
                      </p>
                      <p className="mt-2">
                        <span className="font-bold">What you said:</span> {transcriptionResult.text}
                      </p>
                    </div>
                  )
                )}
              </div>
            )}

            <div className="mt-4 border-t pt-4">
               <h3 className="text-base font-semibold mb-2">How did you do?</h3>
               <div className="flex gap-4">
                <Button
                  onClick={() => handleFeedback('good')}
                  variant={feedbackStatus[currentSentenceIndex] === 'good' ? 'default' : 'outline'}
                  className="flex items-center gap-2"
                >
                  <ThumbsUp size={16} /> Got it!
                </Button>
                <Button
                  onClick={() => handleFeedback('practice')}
                  variant={feedbackStatus[currentSentenceIndex] === 'practice' ? 'destructive' : 'outline'}
                  className="flex items-center gap-2"
                >
                  <ThumbsDown size={16} /> Needs Practice
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accordion Sections */}
      <div className="mt-8">
        <Accordion type="single" collapsible>
          <AccordionItem value="item-1">
            <AccordionTrigger>Translation</AccordionTrigger>
            <AccordionContent>
              {activeSentence?.translation || "No translation available."}
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>Vocabulary</AccordionTrigger>
            <AccordionContent>
              {lesson.vocabulary && lesson.vocabulary.length > 0 ? (
                <ul className="space-y-2">
                  {lesson.vocabulary.map((item, index) => (
                    <li key={index}>
                      <strong className="font-semibold">{item.word}</strong>: {item.meaning}
                      {item.pronunciation && <span className="text-sm text-gray-500 ml-2">[{item.pronunciation}]</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                "No vocabulary available for this lesson."
              )}
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger>Shadowing Tips</AccordionTrigger>
            <AccordionContent>Shadowing tips placeholder.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}