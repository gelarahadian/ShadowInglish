/**
 * Transcript auto-correction.
 *
 * YouTube auto-generated transcripts (and speech-to-text output in general)
 * frequently contain typos: dropped apostrophes ("dont" instead of "don't"),
 * lowercase "i", and other mis-transcriptions. Before a transcript is used for
 * shadowing practice the text is corrected so learners study the right words.
 *
 * Correction has two layers:
 *  1. A deterministic local pass that fixes high-confidence, context-free
 *     errors (apostrophe-less contractions, lowercase "i", common misspellings).
 *  2. An optional LanguageTool API pass that fixes real spelling errors using
 *     the free public endpoint (https://api.languagetool.org). If the API is
 *     unreachable the local pass alone is used (graceful degradation).
 *
 * NOTE: informal spoken English ("gonna", "wanna", "kinda", ...) is kept as-is
 * because that is what the learner actually hears in the audio; normalizing it
 * would break the shadowing target.
 */

const LOCAL_FIXES: Record<string, string> = {
  // Apostrophe-less contractions (very common in auto-generated transcripts).
  // Only tokens that are NOT valid English words are listed, so these fixes
  // can never corrupt a legitimately spelled word.
  dont: "don't",
  cant: "can't",
  wont: "won't",
  isnt: "isn't",
  arent: "aren't",
  wasnt: "wasn't",
  werent: "weren't",
  didnt: "didn't",
  doesnt: "doesn't",
  hasnt: "hasn't",
  havent: "haven't",
  hadnt: "hadn't",
  couldnt: "couldn't",
  shouldnt: "shouldn't",
  wouldnt: "wouldn't",
  mustnt: "mustn't",
  im: "I'm",
  ive: "I've",
  youve: "you've",
  youd: "you'd",
  youll: "you'll",
  youre: "you're",
  hes: "he's",
  shes: "she's",
  theyre: "they're",
  theyve: "they've",
  theyd: "they'd",
  theyll: "they'll",
  weve: "we've",
  thats: "that's",
  whats: "what's",
  whos: "who's",
  hows: "how's",
  wheres: "where's",
  theres: "there's",
  heres: "here's",
  // Standalone ASR artifacts.
  i: "I",
  u: "you",
  yall: "y'all",
  // Common unambiguous misspellings.
  alot: "a lot",
  thru: "through",
  tho: "though",
  everytime: "every time",
};

const LOCAL_FIX_KEYS = Object.keys(LOCAL_FIXES);

const WORD_PATTERN = /^[A-Za-z]+$/;

/** Reconstruct the replacement with the same casing as the original token. */
function matchCase(replacement: string, original: string): string {
  if (original === original.toUpperCase() && original.length > 1) {
    return replacement.toUpperCase();
  }
  if (/^[A-Z]/.test(original)) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/**
 * Apply the deterministic local fixes to a single line of text.
 * Splits on whitespace, strips punctuation around each token, fixes it,
 * then reassembles the line.
 */
export function applyLocalFixes(text: string): string {
  const tokens = text.split(/(\s+)/);
  const corrected = tokens.map((token) => {
    if (!token.trim()) return token;

    const leadingPunctuation = token.match(/^[^A-Za-z0-9]+/)?.[0] ?? "";
    const trailingPunctuation = token.match(/[^A-Za-z0-9]+$/)?.[0] ?? "";
    const coreStart = leadingPunctuation.length;
    const coreEnd = token.length - trailingPunctuation.length;
    const core = token.slice(coreStart, coreEnd);

    if (!WORD_PATTERN.test(core)) return token;

    const lowercase = core.toLowerCase();
    const replacement = LOCAL_FIX_KEYS.includes(lowercase) ? LOCAL_FIXES[lowercase] : null;
    if (replacement === null) return token;

    return `${leadingPunctuation}${matchCase(replacement, core)}${trailingPunctuation}`;
  });

  return corrected.join("");
}

/**
 * Apply the deterministic local fixes plus the LanguageTool API pass to a
 * whole transcript. `text` may contain newlines; each line is processed
 * independently so sentence boundaries survive the round-trip.
 */
async function correctText(text: string): Promise<{ text: string; changes: number }> {
  const localText = text.split("\n").map(applyLocalFixes).join("\n");
  let changes = countChanges(text, localText);

  let finalText = localText;
  try {
    finalText = await correctWithLanguageTool(localText);
    changes += countChanges(localText, finalText);
  } catch {
    // LanguageTool unreachable -> local pass only (graceful degradation).
  }

  return { text: finalText, changes };
}

function countChanges(before: string, after: string): number {
  if (before === after) return 0;
  const beforeTokens = before.split(/\s+/).filter(Boolean);
  const afterTokens = after.split(/\s+/).filter(Boolean);
  let changes = 0;
  const maxLen = Math.max(beforeTokens.length, afterTokens.length);
  for (let i = 0; i < maxLen; i += 1) {
    if (beforeTokens[i] !== afterTokens[i]) changes += 1;
  }
  return changes;
}

// ---------------------------------------------------------------------------
// LanguageTool integration
// ---------------------------------------------------------------------------

const LANGUAGETOOL_API = "https://api.languagetool.org/v2/check";

/** Categories that represent safe, mechanical fixes (spelling/casing/contractions). */
const ALLOWED_CATEGORIES = new Set([
  "TYPOS",
  "CASING",
  "CONTRACTION",
  "COMMON_MISSPELLING",
  "CONFUSED_WORDS",
  "MISC",
]);

type LanguageToolMatch = {
  offset: number;
  length: number;
  replacements: Array<{ value: string }>;
  rule?: {
    issueType?: string;
    category?: { id?: string };
  };
};

function isSafeMatch(match: LanguageToolMatch): boolean {
  if (match.replacements.length === 0) return false;
  const issueType = match.rule?.issueType;
  const categoryId = match.rule?.category?.id;
  if (issueType === "misspelling") return true;
  return categoryId !== undefined && ALLOWED_CATEGORIES.has(categoryId);
}

async function correctWithLanguageTool(text: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(LANGUAGETOOL_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ text, language: "en-US" }),
      signal: controller.signal,
    });
    if (!response.ok) return text;

    const data = (await response.json()) as { matches?: LanguageToolMatch[] };
    const matches = (data.matches ?? []).filter(isSafeMatch);

    // Apply replacements from the end backwards so earlier offsets stay valid.
    let result = text;
    let applied = 0;
    for (const match of [...matches].sort((a, b) => b.offset - a.offset)) {
      const replacement = match.replacements[0]?.value;
      if (replacement === undefined) continue;
      const end = match.offset + match.length;
      if (match.offset < 0 || end > result.length) continue;
      result = result.slice(0, match.offset) + replacement + result.slice(end);
      applied += 1;
      if (applied >= 40) break;
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type CorrectedSentence = { text: string; changes: number };

/**
 * Correct a list of sentence texts in one pass. All sentences are joined into
 * a single block so the LanguageTool API is called once per transcript.
 *
 * Returns the corrected texts (same order and length as the input) plus the
 * total number of changed words.
 */
export async function correctSentences(
  sentences: Array<{ text: string }>,
): Promise<{ correctedTexts: string[]; correctedCount: number }> {
  if (sentences.length === 0) {
    return { correctedTexts: [], correctedCount: 0 };
  }

  const block = sentences.map((sentence) => sentence.text).join("\n");
  const { text: correctedBlock, changes } = await correctText(block);

  const correctedTexts = correctedBlock.split("\n");
  // If the API somehow merged/split lines, fall back to per-line local fixes.
  if (correctedTexts.length !== sentences.length) {
    return {
      correctedTexts: sentences.map((sentence) => applyLocalFixes(sentence.text)),
      correctedCount: 0,
    };
  }

  return { correctedTexts, correctedCount: changes };
}
