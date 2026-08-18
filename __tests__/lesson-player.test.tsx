import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LessonPlayer from "@/app/lessons/[id]/lesson-player";
import { Lesson } from "@/types/lesson";

vi.mock("@/app/lessons/[id]/actions", () => ({
  completeSentence: vi.fn().mockResolvedValue({ success: true }),
  deleteLesson: vi.fn().mockResolvedValue({}),
}));

import { completeSentence } from "@/app/lessons/[id]/actions";

const mockCompleteSentence = vi.mocked(completeSentence);

function makeSentence(id: string, text: string, order: number) {
  return {
    id,
    lesson_id: "l1",
    text,
    translation: null,
    order,
    start_time: order * 5,
    end_time: order * 5 + 3,
    created_at: new Date().toISOString(),
  };
}

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: "l1",
    created_at: new Date().toISOString(),
    title: "My First Lesson",
    description: "A beginner lesson.",
    video_url: null,
    level: "Beginner",
    user_id: null,
    sentences: [
      makeSentence("s1", "This is the first sentence.", 0),
      makeSentence("s2", "This is the second sentence.", 1),
    ],
    vocabulary: [],
    shadowing_tips: null,
    ...overrides,
  };
}

class MockMediaRecorder {
  static isTypeSupported = () => true;
  state: RecordingState = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.onstop?.();
  }
}

function renderPlayer(lesson: Lesson, completedSentenceIds: string[] = [], initialResults: { [key: string]: { score: number; transcribedText: string } } = {}) {
  return render(
    <LessonPlayer
      lesson={lesson}
      completedSentenceIds={completedSentenceIds}
      initialResults={initialResults}
    />,
  );
}

async function recordOnce(user: ReturnType<typeof userEvent.setup>) {
  const recordButton = screen.getByRole("button", { name: /rekam/i });
  await user.click(recordButton);
  const stopButton = screen.getByRole("button", { name: /hentikan rekaman/i });
  await user.click(stopButton);
}

beforeEach(() => {
  vi.clearAllMocks();

  Object.defineProperty(navigator, "mediaDevices", {
    value: {
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }),
    },
    writable: true,
    configurable: true,
  });

  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ transcribedText: "This is the first sentence.", score: 85 }),
    }),
  );
  vi.spyOn(window, "alert").mockImplementation(() => {});
});

describe("LessonPlayer", () => {
  it("renders the lesson title", () => {
    renderPlayer(makeLesson());

    expect(screen.getByText(/My First Lesson/i)).toBeInTheDocument();
  });

  it("shows a colored score label for an initial result", () => {
    renderPlayer(makeLesson(), [], {
      s1: { score: 80, transcribedText: "This is the first sentence." },
    });

    const resultPanel = screen.getByText("Hasil Anda").closest("div");
    expect(within(resultPanel!).getByText("80/100")).toBeInTheDocument();
    const bagusBadge = within(resultPanel!).getByText("Bagus");
    expect(bagusBadge.className).toContain("bg-green-100");
  });

  it("marks Perfect score (100) with the blue label", () => {
    renderPlayer(makeLesson(), [], {
      s1: { score: 100, transcribedText: "This is the first sentence." },
    });

    const resultPanel = screen.getByText("Hasil Anda").closest("div");
    const perfectBadge = within(resultPanel!).getByText("Perfect");
    expect(perfectBadge.className).toContain("bg-blue-100");
  });

  it("keeps the next sentence locked when the previous score is Kurang", () => {
    renderPlayer(makeLesson(), [], {
      s1: { score: 30, transcribedText: "This is the first sentence." },
    });

    const secondSentence = screen.getByText("2. This is the second sentence.");
    expect(secondSentence).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Terkunci" })).toBeInTheDocument();
  });

  it("unlocks the next sentence when the previous score is Cukup", async () => {
    const user = userEvent.setup();
    renderPlayer(makeLesson(), [], {
      s1: { score: 60, transcribedText: "This is the first sentence." },
    });

    expect(screen.queryByRole("img", { name: "Terkunci" })).not.toBeInTheDocument();

    await user.click(screen.getByText("2. This is the second sentence."));
    const activeContainer = screen.getByText("Kalimat Aktif").parentElement;
    expect(activeContainer).toHaveTextContent("This is the second sentence.");
  });

  it("auto-completes and advances when a fresh recording scores Bagus", async () => {
    const user = userEvent.setup();
    renderPlayer(makeLesson());

    await recordOnce(user);

    await waitFor(() => expect(mockCompleteSentence).toHaveBeenCalledWith("s1"));

    const activeContainer = screen.getByText("Kalimat Aktif").parentElement;
    expect(activeContainer).toHaveTextContent("This is the second sentence.");
    const sentenceList = screen.getByText("Kalimat").closest("div");
    expect(within(sentenceList!).getByRole("img", { name: "Selesai" })).toBeInTheDocument();
  });

  it("does not auto-complete when a fresh recording scores Kurang", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ transcribedText: "something else entirely", score: 30 }),
    } as Response);
    renderPlayer(makeLesson());

    await recordOnce(user);

    await waitFor(() => expect(screen.getByText("30/100")).toBeInTheDocument());
    expect(mockCompleteSentence).not.toHaveBeenCalled();
    expect(screen.getByRole("img", { name: "Terkunci" })).toBeInTheDocument();
  });

  it("shows the elapsed recording time while recording", async () => {
    vi.useFakeTimers();
    try {
      renderPlayer(makeLesson());
      fireEvent.click(screen.getByRole("button", { name: /rekam/i }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      await act(async () => {
        vi.advanceTimersByTime(6500);
      });

      expect(screen.getByText(/Merekam 0:06/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not let a stale auto-stop timer cut off a new recording", async () => {
    vi.useFakeTimers();
    try {
      renderPlayer(makeLesson());

      // Recording #1: start, record 3s, stop manually.
      fireEvent.click(screen.getByRole("button", { name: /rekam/i }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });
      fireEvent.click(screen.getByRole("button", { name: /hentikan rekaman/i }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Recording #2: start a fresh recording.
      fireEvent.click(screen.getByRole("button", { name: /rekam \(shadowing anda\)/i }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Pass the point where recording #1's old auto-stop timer would have fired.
      await act(async () => {
        vi.advanceTimersByTime(8000);
      });

      // The new recording must still be live, and only recording #1 transcribed.
      expect(screen.getByRole("button", { name: /hentikan rekaman/i })).toBeInTheDocument();
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
