"use client";

import { useState, useEffect, useRef } from "react";
import ReactPlayer from "react-player";
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
} from "lucide-react";

export default function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const playerRef = useRef<ReactPlayer>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

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

  const handlePlayModelAudio = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(
        activeSentence?.text ?? ""
      );
      utterance.rate = speed;
      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleRecord = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: "audio/wav" });
        // You can now do something with the audioBlob, e.g., play it or upload it
        console.log("Recording stopped, audio blob:", audioBlob);
        setAudioChunks(chunks); // Save chunks if you want to replay
      };

      setIsRecording(true);
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
          <div className="aspect-video bg-gray-200 dark:bg-gray-800 flex items-center justify-center rounded-lg">
            {isClient && lesson.video_url && (
              <ReactPlayer
                ref={playerRef}
                url={lesson.video_url}
                width="100%"
                height="100%"
                controls
                playing={isPlaying}
                playbackRate={speed}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            )}
          </div>
          <div className="mt-4">
            <h2 className="text-lg font-semibold mb-2">Lesson Controls</h2>
            <div className="flex items-center gap-4">
              <Button onClick={handlePreviousSentence} size="icon">
                <Rewind />
              </Button>
              <Button onClick={() => setIsPlaying(!isPlaying)} size="icon">
                {isPlaying ? <Pause /> : <Play />}
              </Button>
              <Button onClick={handleNextSentence} size="icon">
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
                className="flex items-center gap-2"
              >
                {isRecording ? <StopCircle /> : <Mic />}
                {isRecording ? "Stop Recording" : "Record (Your Shadowing)"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Accordion Sections */}
      <div className="mt-8">
        <Accordion type="single" collapsible>
          <AccordionItem value="item-1">
            <AccordionTrigger>Translation</AccordionTrigger>
            <AccordionContent>Translation placeholder.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>Vocabulary</AccordionTrigger>
            <AccordionContent>Vocabulary placeholder.</AccordionContent>
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