type ParsedSentence = {
  text: string;
  start_time: number;
  end_time: number;
};

export type TranscriptEntry = {
  text: string;
  /** Offset in milliseconds (as returned by youtube-transcript). */
  offset: number;
  /** Duration in milliseconds. */
  duration: number;
};

const CREDIT_LINE_PATTERN = /^(translator|transcriber|reviewer|subtitles? by|produced by|edited by|www\.)\b/i;

/**
 * Merge raw caption fragments (each usually 2-5 words long) into full
 * sentences suitable for shadowing practice. A new sentence starts when:
 *  - the accumulated text ends with sentence-ending punctuation AND the next
 *    fragment starts with an uppercase letter, or
 *  - there is a silence gap longer than 2 seconds between fragments, or
 *  - the accumulated sentence has grown too long.
 */
export function segmentTranscript(entries: TranscriptEntry[]): ParsedSentence[] {
  const sentences: ParsedSentence[] = [];
  let current: ParsedSentence | null = null;

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const text = entry.text.replace(/\s+/g, " ").trim();
    if (!text || CREDIT_LINE_PATTERN.test(text)) continue;

    const startTime = entry.offset / 1000;
    const endTime = (entry.offset + entry.duration) / 1000;

    if (current === null) {
      current = { text, start_time: startTime, end_time: endTime };
      continue;
    }

    const gap = startTime - current.end_time;
    const endsSentence = /[.!?…]["')\]]*$/.test(current.text);
    const startsUppercase = /^[A-Z]/.test(text);
    const tooLong = current.text.length > 160;

    if ((endsSentence && startsUppercase) || gap > 2 || tooLong) {
      sentences.push(current);
      current = { text, start_time: startTime, end_time: endTime };
    } else {
      current = {
        text: `${current.text} ${text}`.trim(),
        start_time: current.start_time,
        end_time: endTime,
      };
    }
  }

  if (current !== null) sentences.push(current);
  return sentences;
}


export function parseTimestamp(value: string): number | null {
  const normalizedValue = value.trim().replace(",", ".");

  // Strict check for mm.ss format
  const minuteSecondMatch = normalizedValue.match(/^(\d+)\.(\d{2})$/);
  if (minuteSecondMatch && !normalizedValue.includes(':')) {
      const minutes = parseInt(minuteSecondMatch[1], 10);
      const seconds = parseInt(minuteSecondMatch[2], 10);
      if (!isNaN(minutes) && !isNaN(seconds)) {
        return (minutes * 60) + seconds;
      }
  }

  // Handle hh:mm:ss
  if (normalizedValue.includes(":")) {
    const parts = normalizedValue.split(":");
    if (parts.length < 2 || parts.length > 3) return null;

    const seconds = Number(parts.pop());
    const minutes = Number(parts.pop());
    const hours = parts.length === 1 ? Number(parts.pop()) : 0;
    if ([seconds, minutes, hours].some((part) => Number.isNaN(part))) return null;

    return hours * 3_600 + minutes * 60 + seconds;
  }

  // Fallback for raw seconds (including floating point like 90.5 or 0.010)
  const asNumber = parseFloat(normalizedValue);
  return isNaN(asNumber) ? null : asNumber * 100;
}


function createTranscriptSentences(entries: Array<{ text: string; start_time: number; end_time?: number }>): ParsedSentence[] {
  return entries
    .map((entry, index) => ({
      text: entry.text.replace(/\s+/g, " ").trim(),
      start_time: entry.start_time,
      end_time: entry.end_time ?? entries[index + 1]?.start_time ?? entry.start_time + 5,
    }))
    .filter((entry) => entry.text.length > 0)
    .map((entry) => ({
      ...entry,
      end_time: entry.end_time > entry.start_time ? entry.end_time : entry.start_time + 5,
    }));
}

export function parseTimestampedTranscript(transcript: string): ParsedSentence[] {
  const normalizedTranscript = transcript.replace(/\r\n/g, "\n").trim();
  if (!normalizedTranscript) return [];

  const subtitleEntries = normalizedTranscript
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block && block !== "WEBVTT")
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const timestampIndex = lines.findIndex((line) => line.includes("-->"));
      if (timestampIndex === -1) return null;

      const [start, end] = lines[timestampIndex].split("-->").map((timestamp) => parseTimestamp(timestamp.trim().split(/\s+/)[0]));
      if (start === null || end === null) return null;
      return { text: lines.slice(timestampIndex + 1).join(" "), start_time: start, end_time: end };
    })
    .filter((entry): entry is { text: string; start_time: number; end_time: number } => entry !== null);

  if (subtitleEntries.length > 0) return createTranscriptSentences(subtitleEntries);

  const timestampPattern = /^\s*((?:(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d+)?|\d+(?:[.]\d+)?))\s*(?:detik)?\s*(.*)$/;
  const entries: Array<{ text: string; start_time: number }> = [];
  let currentEntry: { text: string; start_time: number } | null = null;

  for (const line of normalizedTranscript.split("\n")) {
    const match = line.match(timestampPattern);
    if (match) {
      if (currentEntry) entries.push(currentEntry);
      const startTime = parseTimestamp(match[1]);
      currentEntry = startTime === null ? null : { text: match[2].trim(), start_time: startTime };
    } else if (currentEntry && line.trim()) {
      currentEntry.text = `${currentEntry.text} ${line.trim()}`.trim();
    }
  }
  if (currentEntry) entries.push(currentEntry);

  return createTranscriptSentences(entries);
}
