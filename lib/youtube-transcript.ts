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
  console.log(`[transcript] Starting fetch for videoId=${videoId}`);

  const { tracks, clientName } = await discoverCaptionTracks(videoId);
  console.log(
    `[discovery] Result: clientName=${clientName}, trackCount=${tracks.length}`,
  );

  if (tracks.length === 0) {
    console.error(`[transcript] NO caption tracks found from any strategy`);
    throw new Error("NO_CAPTION_TRACKS");
  }

  const track = selectEnglishTrack(tracks) ?? tracks[0];
  const baseUrl = track?.baseUrl;
  if (!baseUrl) {
    console.error(`[transcript] Selected track has no baseUrl`);
    throw new Error("NO_CAPTION_TRACKS");
  }

  const lang = track.languageCode ?? track.language_code ?? "en";
  console.log(
    `[transcript] Selected track: lang=${lang}, kind=${track.kind ?? "none"}, baseUrl=${baseUrl.substring(0, 120)}...`,
  );

  const xml = await fetchTimedtextXml(baseUrl);
  console.log(`[transcript] Fetched XML length=${xml.length}`);

  return parseTranscriptXml(xml, lang);
}

/* ------------------------------------------------------------------ */
/*  Caption track discovery — multi-client cascade                     */
/* ------------------------------------------------------------------ */

async function discoverCaptionTracks(
  videoId: string,
): Promise<{ tracks: CaptionTrack[]; clientName: string }> {
  console.log(`[discovery] Starting cascade for videoId=${videoId}`);

  // Strategy 1 & 2: InnerTube player API with different client types
  for (const client of CLIENTS) {
    try {
      console.log(`[discovery] Trying ${client.name} client...`);
      const tracks = await fetchCaptionTracksViaInnerTube(videoId, client);
      console.log(
        `[discovery] ${client.name}: HTTP OK, trackCount=${tracks.length}`,
      );
      if (tracks.length > 0) {
        for (const t of tracks) {
          console.log(
            `[discovery]   track: lang=${t.languageCode ?? t.language_code}, kind=${t.kind ?? "none"}, hasUrl=${!!t.baseUrl}`,
          );
        }
        return { tracks, clientName: client.name };
      }
      console.warn(`[discovery] ${client.name}:0 tracks in response`);
    } catch (err) {
      console.warn(
        `[discovery] ${client.name} failed:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // Strategy 3: Scrape YouTube watch page for ytInitialPlayerResponse
  try {
    console.log(`[discovery] Trying PAGE_SCRAPE...`);
    const tracks = await fetchCaptionTracksViaPageScrape(videoId);
    console.log(`[discovery] PAGE_SCRAPE: trackCount=${tracks.length}`);
    if (tracks.length > 0) {
      for (const t of tracks) {
        console.log(
          `[discovery]   track: lang=${t.languageCode ?? t.language_code}, kind=${t.kind ?? "none"}, hasUrl=${!!t.baseUrl}`,
        );
      }
      return { tracks, clientName: "PAGE_SCRAPE" };
    }
  } catch (err) {
    console.warn(
      `[discovery] PAGE_SCRAPE failed:`,
      err instanceof Error ? err.message : String(err),
    );
  }

  console.error(`[discovery] All strategies exhausted, no tracks found`);
  return { tracks: [], clientName: "NONE" };
}

/* ------------------------------------------------------------------ */
/*  InnerTube player API                                               */
/* ------------------------------------------------------------------ */

async function fetchCaptionTracksViaInnerTube(
  videoId: string,
  client: InnerTubeClient,
): Promise<CaptionTrack[]> {
  const body = JSON.stringify({
    context: client.context,
    videoId,
  });
  console.log(
    `[innertube] POST ${INNERTUBE_PLAYER_URL} client=${client.name} UA=${client.userAgent}`,
  );

  const resp = await fetch(INNERTUBE_PLAYER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": client.userAgent,
    },
    body,
  });

  console.log(`[innertube] ${client.name} response: status=${resp.status}`);

  if (!resp.ok) {
    throw new Error(`INNERTUBE_HTTP_${resp.status}`);
  }

  const raw = await resp.json();

  const playability = (raw as Record<string, unknown>)?.playabilityStatus;
  console.log(
    `[innertube] ${client.name} playabilityStatus:`,
    JSON.stringify(playability)?.substring(0, 200),
  );

  const hasCaptions = !!raw?.captions;
  const trackCount =
    raw?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length ?? 0;
  console.log(
    `[innertube] ${client.name} hasCaptions=${hasCaptions}, trackCount=${trackCount}`,
  );

  if (trackCount === 0) {
    const keys = Object.keys(raw ?? {});
    console.log(`[innertube] ${client.name} response top-level keys: ${keys.join(", ")}`);
  }

  return (
    raw?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
  );
}

/* ------------------------------------------------------------------ */
/*  Page scrape strategy                                               */
/* ------------------------------------------------------------------ */

async function fetchCaptionTracksViaPageScrape(
  videoId: string,
): Promise<CaptionTrack[]> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  console.log(`[scrape] GET ${url}`);

  const resp = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      Cookie:
        "CONSENT=PENDING+987; SOCS=CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjMwODI5LjA3X3AxGgJlbiACGgYIgJnsBhAB",
    },
    redirect: "follow",
  });

  console.log(`[scrape] Response: status=${resp.status}`);

  if (!resp.ok) {
    throw new Error(`PAGE_HTTP_${resp.status}`);
  }

  const html = await resp.text();
  console.log(`[scrape] HTML length=${html.length}`);

  const marker = "var ytInitialPlayerResponse = ";
  const idx = html.indexOf(marker);
  if (idx === -1) {
    const hasRecaptcha = html.includes("g-recaptcha");
    const hasConsent = html.includes("consent.youtube.com");
    console.error(
      `[scrape] No ytInitialPlayerResponse found. recaptcha=${hasRecaptcha}, consent=${hasConsent}`,
    );
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
        const tracks =
          playerResponse?.captions?.playerCaptionsTracklistRenderer
            ?.captionTracks ?? [];
        console.log(`[scrape] Parsed playerResponse, trackCount=${tracks.length}`);
        return tracks;
      }
    }
  }

  console.error(`[scrape] Failed to parse JSON (unbalanced braces)`);
  throw new Error("PAGE_PARSE_ERROR");
}

/* ------------------------------------------------------------------ */
/*  Fetch + parse timedtext XML                                        */
/* ------------------------------------------------------------------ */

async function fetchTimedtextXml(baseUrl: string): Promise<string> {
  console.log(
    `[timedtext] GET ${baseUrl.substring(0, 120)}...`,
  );

  const resp = await fetch(baseUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  console.log(`[timedtext] Response: status=${resp.status}`);

  if (!resp.ok) {
    throw new Error(`TIMEDTEXT_HTTP_${resp.status}`);
  }

  const xml = await resp.text();
  console.log(`[timedtext] Body length=${xml.length}`);

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
  const srv3Results = parseSrv3(xml);
  if (srv3Results.length > 0) {
    console.log(`[parse] srv3 format: ${srv3Results.length} entries`);
    return srv3Results;
  }

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
  console.log(`[parse] classic format: ${results.length} entries`);
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
