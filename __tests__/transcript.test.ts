import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyLocalFixes, correctSentences } from "@/lib/correction";
import { parseTimestampedTranscript, segmentTranscript } from "@/lib/transcript";

describe("applyLocalFixes", () => {
  it("fixes apostrophe-less contractions", () => {
    expect(applyLocalFixes("dont worry, cant stop")).toBe("don't worry, can't stop");
    expect(applyLocalFixes("Im ready to go")).toBe("I'm ready to go");
    expect(applyLocalFixes("its fine")).toBe("its fine");
  });

  it("fixes standalone lowercase i and u", () => {
    expect(applyLocalFixes("i think u are right")).toBe("I think you are right");
  });

  it("preserves casing of the original token", () => {
    expect(applyLocalFixes("Dont Do That")).toBe("Don't Do That");
  });

  it("keeps informal spoken English untouched", () => {
    expect(applyLocalFixes("gonna wanna kinda gotta")).toBe("gonna wanna kinda gotta");
  });

  it("fixes common misspellings", () => {
    expect(applyLocalFixes("alot of people come thru here")).toBe("a lot of people come through here");
  });

  it("preserves punctuation around fixed tokens", () => {
    expect(applyLocalFixes("(dont) [cant], im!")).toBe("(don't) [can't], I'm!");
  });

  it("handles empty input", () => {
    expect(applyLocalFixes("")).toBe("");
  });
});

describe("correctSentences", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          matches: [
            {
              offset: 0,
              length: 3,
              replacements: [{ value: "the" }],
              rule: { issueType: "misspelling", category: { id: "TYPOS" } },
            },
          ],
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies LanguageTool replacements and reports change count", async () => {
    const { correctedTexts, correctedCount } = await correctSentences([
      { text: "teh best way" },
      { text: "to learn is practice" },
    ]);

    expect(correctedTexts[0]).toBe("the best way");
    expect(correctedTexts[1]).toBe("to learn is practice");
    expect(correctedCount).toBe(1);
  });

  it("falls back to local fixes when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const { correctedTexts } = await correctSentences([
      { text: "dont give up" },
    ]);

    expect(correctedTexts[0]).toBe("don't give up");
  });
});

describe("segmentTranscript", () => {
  it("merges consecutive fragments into one sentence", () => {
    const sentences = segmentTranscript([
      { text: "Hello", offset: 0, duration: 1000 },
      { text: "world", offset: 1000, duration: 1000 },
    ]);

    expect(sentences).toEqual([
      { text: "Hello world", start_time: 0, end_time: 2 },
    ]);
  });

  it("starts a new sentence after a long silence gap", () => {
    const sentences = segmentTranscript([
      { text: "First part", offset: 0, duration: 1000 },
      { text: "Second part", offset: 10_000, duration: 1000 },
    ]);

    expect(sentences).toHaveLength(2);
    expect(sentences[0].text).toBe("First part");
    expect(sentences[1].text).toBe("Second part");
    expect(sentences[1].start_time).toBe(10);
  });

  it("breaks after sentence-ending punctuation followed by an uppercase word", () => {
    const sentences = segmentTranscript([
      { text: "Yes.", offset: 0, duration: 1000 },
      { text: "Exactly.", offset: 1000, duration: 1000 },
    ]);

    expect(sentences).toHaveLength(2);
    expect(sentences[0].text).toBe("Yes.");
    expect(sentences[1].text).toBe("Exactly.");
  });

  it("skips credit lines found at the top of YouTube transcripts", () => {
    const sentences = segmentTranscript([
      { text: "Translator: Joseph Geni\nReviewer: Morton Bast", offset: 0, duration: 7000 },
      { text: "When I was twenty seven", offset: 7000, duration: 2000 },
      { text: "I quit a very demanding job", offset: 9000, duration: 2000 },
    ]);

    expect(sentences).toHaveLength(1);
    expect(sentences[0].text).toBe("When I was twenty seven I quit a very demanding job");
    expect(sentences[0].start_time).toBe(7);
    expect(sentences[0].end_time).toBe(11);
  });
});

describe("parseTimestampedTranscript", () => {
  it("parses YouTube-style timestamps", () => {
    const sentences = parseTimestampedTranscript("0.18 Hello there.\n0.21 How are you?");

    expect(sentences).toHaveLength(2);
    expect(sentences[0].text).toBe("Hello there.");
    expect(sentences[0].start_time).toBe(18);
    expect(sentences[0].end_time).toBe(21);
    expect(sentences[1].text).toBe("How are you?");
  });
});
