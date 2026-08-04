import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import LessonPlayer from '@/app/lessons/[id]/lesson-player';
import { Lesson } from '@/types/lesson';

// Mock ReactPlayer to avoid errors in test environment
vi.mock('react-player', () => ({
  default: () => <div data-testid="react-player-mock"></div>,
}));

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({}),
  },
  writable: true,
});


const mockLesson: Lesson = {
  id: '1',
  title: 'My First Lesson',
  description: 'A beginner lesson.',
  level: 'Beginner',
  video_url: 'http://example.com/video.mp4',
  sentences: [
    { id: 's1', text: 'This is the first sentence.', timestamp: 0 },
    { id: 's2', text: 'This is the second sentence.', timestamp: 5 },
  ],
};

describe('LessonPlayer', () => {
  it('should render the lesson title', () => {
    render(<LessonPlayer lesson={mockLesson} />);

    // Check for the breadcrumb title
    const titleElement = screen.getByText(/My First Lesson/i);
    expect(titleElement).toBeInTheDocument();
  });

  it('should navigate between sentences using next and previous buttons', async () => {
    const user = userEvent.setup();
    render(<LessonPlayer lesson={mockLesson} />);

    // Get the container for the active sentence
    const activeSentenceContainer = screen.getByText('Active Sentence').parentElement;

    // Initially, the first sentence is active
    expect(activeSentenceContainer).toHaveTextContent(mockLesson.sentences[0].text);
    expect(activeSentenceContainer).not.toHaveTextContent(mockLesson.sentences[1].text);

    // Find the next button by its accessible name (aria-label)
    const nextButton = screen.getByRole('button', { name: /next sentence/i });
    await user.click(nextButton);

    // Now, the second sentence should be active
    expect(activeSentenceContainer).not.toHaveTextContent(mockLesson.sentences[0].text);
    expect(activeSentenceContainer).toHaveTextContent(mockLesson.sentences[1].text);

    // Find the previous button
    const prevButton = screen.getByRole('button', { name: /previous sentence/i });
    await user.click(prevButton);

    // We should be back to the first sentence
    expect(activeSentenceContainer).toHaveTextContent(mockLesson.sentences[0].text);
    expect(activeSentenceContainer).not.toHaveTextContent(mockLesson.sentences[1].text);
  });

  it('should handle feedback buttons and display status in the list', async () => {
    const user = userEvent.setup();
    render(<LessonPlayer lesson={mockLesson} />);

    // Get the first sentence item from the list
    const firstSentenceItem = screen.getByText(`1. ${mockLesson.sentences[0].text}`).parentElement;
    expect(firstSentenceItem).toBeInTheDocument();

    // Initially, no feedback icons should be visible for the first sentence
    expect(within(firstSentenceItem!).queryByRole('img', { name: 'Good' })).not.toBeInTheDocument();
    expect(within(firstSentenceItem!).queryByRole('img', { name: 'Needs Practice' })).not.toBeInTheDocument();

    // Click "Got it!" button
    const gotItButton = screen.getByRole('button', { name: /got it/i });
    await user.click(gotItButton);

    // Now, a "Good" icon should be visible within the first sentence item
    const thumbsUpIcon = within(firstSentenceItem!).getByRole('img', { name: 'Good' });
    expect(thumbsUpIcon).toBeInTheDocument();
    expect(within(firstSentenceItem!).queryByRole('img', { name: 'Needs Practice' })).not.toBeInTheDocument();

    // Click "Needs Practice" button
    const needsPracticeButton = screen.getByRole('button', { name: /needs practice/i });
    await user.click(needsPracticeButton);

    // Now, a "Needs Practice" icon should be visible, and "Good" icon should be gone
    const thumbsDownIcon = within(firstSentenceItem!).getByRole('img', { name: 'Needs Practice' });
    expect(thumbsDownIcon).toBeInTheDocument();
    expect(within(firstSentenceItem!).queryByRole('img', { name: 'Good' })).not.toBeInTheDocument();
  });
});
