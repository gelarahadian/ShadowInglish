/**
 * YouTube transcript fetcher.
 *
 * Uses YouTube's InnerTube ANDROID client API to discover caption tracks,
 * then fetches the timedtext XML directly. This approach works reliably from
 * cloud/Vercel IPs because the ANDROID client context produces timedtext URLs
 * that are not gated by the same anti-bot measures as the WEB client.
 *
 * Previously used `youtube-transcript` (npm) which relied on the same ANDROID
 * InnerTube call but bundled its own fetch logic. Replaced with this custom
 * implementation to have full control over the fetch pipeline and error
 * handling, and to drop the unnecessary dependency.
 */

import type { TranscriptEntry } from "@/lib/transcript";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const INNERTUBE_PLAYER_URL =
  "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
const INNERTUBE_CLIENT_VERSION = "20.10.38";
const INNERTUBE_CONTEXT = {
  client: {
    clientName: "ANDROID",
    clientVersion: INNERTUBE_CLIENT_VERSION,
  },
};
const INNERTUBE_USER_AGENT = `com.google.android.youtube/${INNERTUBE_CLIENT_VERSION} (Linux; U; Android 14)`;

const RE_XML_TRANSCRIPT =
  /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;

const ENGLISH_LANGS = ["en", "en-US", "en-GB", "en-orig"];

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CaptionTrack {
  baseUrl?: string;
  languageCode?: string;
  language_code?: string;
  kind?: string;
}

interface InnerTubePlayerResponse {
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
    };
  };
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Fetch transcript entries for a YouTube video.
 *
 * Prefers English tracks (en → en-US → en-GB → en-orig, then ASR),
 * falls back to the first available track.
 *
 * @throws {Error} with message NO_CAPTION_TRACKS, TIMEDTEXT_HTTP_*, or
 *         TIMEDTEXT_EMPTY when the transcript cannot be retrieved.
 */
export async function fetchYouTubeTranscript(
  videoId: string,
): Promise<TranscriptEntry[]> {
  const captionTracks = await fetchCaptionTracks(videoId);

  if (captionTracks.length === 0) {
    throw new Error("NO_CAPTION_TRACKS");
  }

  const track = selectEnglishTrack(captionTracks) ?? captionTracks[0];
  const baseUrl = track?.baseUrl;
  if (!baseUrl) {
    throw new Error("NO_CAPTION_TRACKS");
  }

  const xml = await fetchTimedtextXml(baseUrl);
  const lang =
    track.languageCode ?? track.language_code ?? "en";

  return parseTranscriptXml(xml, lang);
}

/* ------------------------------------------------------------------ */
/*  InnerTube: discover caption tracks                                 */
/* ------------------------------------------------------------------ */

async function fetchCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
  const resp = await fetch(INNERTUBE_PLAYER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": INNERTUBE_USER_AGENT,
    },
    body: JSON.stringify({
      context: INNERTUBE_CONTEXT,
      videoId,
    }),
  });

  if (!resp.ok) {
    throw new Error(`INNERTUBE_HTTP_${resp.status}`);
  }

  const data: InnerTubePlayerResponse = await resp.json();
  return data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
}

/* ------------------------------------------------------------------ */
/*  Fetch + parse timedtext XML                                        */
/* ------------------------------------------------------------------ */

async function fetchTimedtextXml(baseUrl: string): Promise<string> {
  const resp = await fetch(baseUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!resp.ok) {
    throw new Error(`TIMEDTEXT_HTTP_${resp.status}`);
  }

  const xml = await resp.text();
  if (!xml || xml.length === 0) {
    throw new Error("TIMEDTEXT_EMPTY");
  }

  return xml;
}

/* ------------------------------------------------------------------ */
/*  XML parsing                                                        */
/* ------------------------------------------------------------------ */

/**
 * Parse transcript XML. Supports both srv3 format (`<p t="ms">`) and
 * classic format (`<text start="s" dur="s">`).
 */
function parseTranscriptXml(xml: string, lang: string): TranscriptEntry[] {
  // Try srv3 format first
  const srv3Results = parseSrv3(xml);
  if (srv3Results.length > 0) return srv3Results;

  // Classic format
  const results: TranscriptEntry[] = [];
  for (const m of xml.matchAll(RE_XML_TRANSCRIPT)) {
    const text = decodeEntities(m[3]);
    if (text) {
      results.push({
        text,
        offset: Math.round(parseFloat(m[1]) * 1000),
        duration: Math.round(parseFloat(m[2]) * 1000),
      });
    }
  }
  return results;
}

function parseSrv3(xml: string): TranscriptEntry[] {
  const results: TranscriptEntry[] = [];
  const pRegex =
    /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let match;
  while ((match = pRegex.exec(xml)) !== null) {
    const startMs = parseInt(match[1], 10);
    const durMs = parseInt(match[2], 10);
    const inner = match[3];

    let text = "";
    const sRegex = /<s[^>]*>([^<]*)<\/s>/g;
    let sMatch;
    while ((sMatch = sRegex.exec(inner)) !== null) {
      text += sMatch[1];
    }
    if (!text) {
      text = inner.replace(/<[^>]+>/g, "");
    }

    text = decodeEntities(text).trim();
    if (text) {
      results.push({ text, offset: startMs, duration: durMs });
    }
  }
  return results;
}

/* ------------------------------------------------------------------ */
/*  Track selection                                                    */
/* ------------------------------------------------------------------ */

function selectEnglishTrack(
  tracks: CaptionTrack[],
): CaptionTrack | undefined {
  for (const lang of ENGLISH_LANGS) {
    const match = tracks.find(
      (t) =>
        t.languageCode === lang ||
        t.language_code === lang ||
        (lang === "en" && t.kind === "asr"),
    );
    if (match) return match;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(parseInt(dec, 10)),
    );
}
