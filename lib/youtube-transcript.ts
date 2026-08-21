/**
 * YouTube transcript fetcher.
 *
 * Uses YouTube's InnerTube player API with multiple client strategies
 * (ANDROID → IOS → page scrape) to discover caption tracks, then fetches
 * the timedtext XML directly.
 *
 * ANDROID is tried first because its timedtext URLs include `exp` params
 * that can cause empty responses.  IOS URLs do NOT include `exp` and
 * produce clean timedtext URLs.  Page scraping is the last resort.
 *
 * Previously used `youtube-transcript` (npm) which failed on Vercel due to
 * YouTube blocking the ANDROID client from cloud IPs.  This custom
 * implementation tries multiple client types to maximise the chance of
 * success from any IP.
 */

import type { TranscriptEntry } from "@/lib/transcript";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const INNERTUBE_PLAYER_URL =
  "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";

const ENGLISH_LANGS = ["en", "en-US", "en-GB", "en-orig"];

const RE_XML_TRANSCRIPT =
  /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;

/* ------------------------------------------------------------------ */
/*  Client configurations (tried in order)                             */
/* ------------------------------------------------------------------ */

interface InnerTubeClient {
  name: string;
  context: { client: { clientName: string; clientVersion: string } };
  userAgent: string;
}

const CLIENTS: InnerTubeClient[] = [
  {
    name: "ANDROID",
    context: {
      client: { clientName: "ANDROID", clientVersion: "20.10.38" },
    },
    userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
  },
  {
    name: "IOS",
    context: {
      client: { clientName: "IOS", clientVersion: "20.10.38" },
    },
    userAgent:
      "com.google.ios.youtube/20.10.38 (iPhone16,2; U; CPU iOS 18_2_1 like Mac OS X)",
  },
];

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
 * Tries multiple InnerTube client types to discover caption tracks,
 * then fetches the timedtext XML from the first working track.
 *
 * @throws {Error} with message NO_CAPTION_TRACKS, TIMEDTEXT_HTTP_*, or
 *         TIMEDTEXT_EMPTY when the transcript cannot be retrieved.
 */
export async function fetchYouTubeTranscript(
  videoId: string,
): Promise<TranscriptEntry[]> {
  const { tracks, clientName } = await discoverCaptionTracks(videoId);

  if (tracks.length === 0) {
    throw new Error("NO_CAPTION_TRACKS");
  }

  const track = selectEnglishTrack(tracks) ?? tracks[0];
  const baseUrl = track?.baseUrl;
  if (!baseUrl) {
    throw new Error("NO_CAPTION_TRACKS");
  }

  const xml = await fetchTimedtextXml(baseUrl);
  const lang = track.languageCode ?? track.language_code ?? "en";

  return parseTranscriptXml(xml, lang);
}

/* ------------------------------------------------------------------ */
/*  Caption track discovery — multi-client cascade                     */
/* ------------------------------------------------------------------ */

async function discoverCaptionTracks(
  videoId: string,
): Promise<{ tracks: CaptionTrack[]; clientName: string }> {
  // Strategy 1 & 2: InnerTube player API with different client types
  for (const client of CLIENTS) {
    try {
      const tracks = await fetchCaptionTracksViaInnerTube(videoId, client);
      if (tracks.length > 0) {
        return { tracks, clientName: client.name };
      }
    } catch (err) {
      // Log but continue to next strategy
      console.warn(
        `[transcript] ${client.name} client returned no tracks or failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Strategy 3: Scrape YouTube watch page for ytInitialPlayerResponse
  try {
    const tracks = await fetchCaptionTracksViaPageScrape(videoId);
    if (tracks.length > 0) {
      return { tracks, clientName: "PAGE_SCRAPE" };
    }
  } catch (err) {
    console.warn(
      "[transcript] Page scrape failed:",
      err instanceof Error ? err.message : err,
    );
  }

  return { tracks: [], clientName: "NONE" };
}

/* ------------------------------------------------------------------ */
/*  InnerTube player API                                               */
/* ------------------------------------------------------------------ */

async function fetchCaptionTracksViaInnerTube(
  videoId: string,
  client: InnerTubeClient,
): Promise<CaptionTrack[]> {
  const resp = await fetch(INNERTUBE_PLAYER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": client.userAgent,
    },
    body: JSON.stringify({
      context: client.context,
      videoId,
    }),
  });

  if (!resp.ok) {
    throw new Error(`INNERTUBE_HTTP_${resp.status}`);
  }

  const data: InnerTubePlayerResponse = await resp.json();
  return (
    data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
  );
}

/* ------------------------------------------------------------------ */
/*  Page scrape strategy                                               */
/* ------------------------------------------------------------------ */

async function fetchCaptionTracksViaPageScrape(
  videoId: string,
): Promise<CaptionTrack[]> {
  const resp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      Cookie:
        "CONSENT=PENDING+987; SOCS=CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjMwODI5LjA3X3AxGgJlbiACGgYIgJnsBhAB",
    },
    redirect: "follow",
  });

  if (!resp.ok) {
    throw new Error(`PAGE_HTTP_${resp.status}`);
  }

  const html = await resp.text();

  // Look for ytInitialPlayerResponse in a <script> tag
  const marker = "var ytInitialPlayerResponse = ";
  const idx = html.indexOf(marker);
  if (idx === -1) {
    throw new Error("PAGE_NO_PLAYER_RESPONSE");
  }

  const jsonStart = idx + marker.length;
  let depth = 0;
  for (let i = jsonStart; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") {
      depth--;
      if (depth === 0) {
        const playerResponse: InnerTubePlayerResponse = JSON.parse(
          html.slice(jsonStart, i + 1),
        );
        return (
          playerResponse?.captions?.playerCaptionsTracklistRenderer
            ?.captionTracks ?? []
        );
      }
    }
  }

  throw new Error("PAGE_PARSE_ERROR");
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
function parseTranscriptXml(xml: string, _lang: string): TranscriptEntry[] {
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
