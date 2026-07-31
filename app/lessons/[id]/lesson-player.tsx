"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Lesson } from "@/types/lesson";

export default function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);

  const handleNextSentence = () => {
    if (currentSentenceIndex < lesson.sentences.length - 1) {
      setCurrentSentenceIndex(currentSentenceIndex + 1);
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
            <p>Video Player Placeholder</p>
          </div>
          <div className="mt-4">
            <h2 className="text-lg font-semibold">Lesson Controls</h2>
            {/* Add lesson controls here */}
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
              <Button variant="default">Play (Model Audio)</Button>
              <Button variant="destructive">Record (Your Shadowing)</Button>
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
              {/* Translation content goes here */}
              Translation placeholder.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>Vocabulary</AccordionTrigger>
            <AccordionContent>
              {/* Vocabulary content goes here */}
              Vocabulary placeholder.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger>Shadowing Tips</AccordionTrigger>
            <AccordionContent>
              {/* Shadowing tips content goes here */}
              Shadowing tips placeholder.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <div className="mt-8 text-center">
        <Button onClick={handleNextSentence}>Next Sentence</Button>
      </div>
    </div>
  );
}