import type { TranscriptEntry } from "@/lib/transcript";

const ENGLISH_LANGS = ["en", "en-US", "en-GB", "en-orig"];

const RE_XML_TRANSCRIPT =
  /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;

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
/*  Caption track discovery — multi-strategy cascade                   */
/* ------------------------------------------------------------------ */

async function discoverCaptionTracks(
  videoId: string,
): Promise<{ tracks: CaptionTrack[]; clientName: string }> {
  console.log(`[discovery] Starting cascade for videoId=${videoId}`);

  // Strategy 1: youtubei.js with ANDROID client + local session (PO token)
  try {
    console.log(`[discovery] Trying YOUTUBEI_JS (ANDROID)...`);
    const tracks = await fetchCaptionTracksViaYoutubeiJs(videoId);
    console.log(
      `[discovery] YOUTUBEI_JS: trackCount=${tracks.length}`,
    );
    if (tracks.length > 0) {
      for (const t of tracks) {
        console.log(
          `[discovery]   track: lang=${t.languageCode ?? t.language_code}, kind=${t.kind ?? "none"}, hasUrl=${!!t.baseUrl}`,
        );
      }
      return { tracks, clientName: "YOUTUBEI_JS" };
    }
  } catch (err) {
    console.warn(
      `[discovery] YOUTUBEI_JS failed:`,
      err instanceof Error ? err.message : String(err),
    );
  }

  // Strategy 2: Raw InnerTube ANDROID
  try {
    console.log(`[discovery] Trying ANDROID (raw)...`);
    const tracks = await fetchCaptionTracksViaInnerTube(videoId, {
      name: "ANDROID",
      context: { client: { clientName: "ANDROID", clientVersion: "20.10.38" } },
      userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
    });
    if (tracks.length > 0) {
      return { tracks, clientName: "ANDROID" };
    }
  } catch (err) {
    console.warn(
      `[discovery] ANDROID failed:`,
      err instanceof Error ? err.message : String(err),
    );
  }

  // Strategy 3: Raw InnerTube IOS
  try {
    console.log(`[discovery] Trying IOS (raw)...`);
    const tracks = await fetchCaptionTracksViaInnerTube(videoId, {
      name: "IOS",
      context: { client: { clientName: "IOS", clientVersion: "20.10.38" } },
      userAgent:
        "com.google.ios.youtube/20.10.38 (iPhone16,2; U; CPU iOS 18_2_1 like Mac OS X)",
    });
    if (tracks.length > 0) {
      return { tracks, clientName: "IOS" };
    }
  } catch (err) {
    console.warn(
      `[discovery] IOS failed:`,
      err instanceof Error ? err.message : String(err),
    );
  }

  // Strategy 4: Page scrape
  try {
    console.log(`[discovery] Trying PAGE_SCRAPE...`);
    const tracks = await fetchCaptionTracksViaPageScrape(videoId);
    if (tracks.length > 0) {
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
/*  Strategy 1: youtubei.js ANDROID with local session + PO token      */
/* ------------------------------------------------------------------ */

async function fetchCaptionTracksViaYoutubeiJs(
  videoId: string,
): Promise<CaptionTrack[]> {
  const { Innertube } = await import("youtubei.js");

  const yt = await Innertube.create({
    lang: "en",
    location: "US",
    generate_session_locally: true,
    retrieve_player: false,
  });

  console.log(`[youtubei] Session created, fetching player for ${videoId}`);

  const response = await yt.actions.execute("/player", {
    client: "ANDROID",
    videoId,
    clientVersion: "20.10.38",
  });

  const raw = response.data as InnerTubePlayerResponse;
  const tracks =
    raw?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

  console.log(`[youtubei] ANDROID player: trackCount=${tracks.length}`);

  return tracks;
}

/* ------------------------------------------------------------------ */
/*  Strategy 2/3: Raw InnerTube player API                             */
/* ------------------------------------------------------------------ */

interface InnerTubeClient {
  name: string;
  context: { client: { clientName: string; clientVersion: string } };
  userAgent: string;
}

async function fetchCaptionTracksViaInnerTube(
  videoId: string,
  client: InnerTubeClient,
): Promise<CaptionTrack[]> {
  const resp = await fetch(
    "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": client.userAgent,
      },
      body: JSON.stringify({ context: client.context, videoId }),
    },
  );

  console.log(`[innertube] ${client.name} status=${resp.status}`);

  if (!resp.ok) throw new Error(`INNERTUBE_HTTP_${resp.status}`);

  const raw = await resp.json();
  const trackCount =
    raw?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length ?? 0;

  const status = (raw as Record<string, unknown>)?.playabilityStatus;
  console.log(
    `[innertube] ${client.name} playability=${(status as Record<string, unknown>)?.status}, trackCount=${trackCount}`,
  );

  return (
    raw?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
  );
}

/* ------------------------------------------------------------------ */
/*  Strategy 4: Page scrape for ytInitialPlayerResponse                */
/* ------------------------------------------------------------------ */

async function fetchCaptionTracksViaPageScrape(
  videoId: string,
): Promise<CaptionTrack[]> {
  console.log(`[scrape] GET watch?v=${videoId}`);

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

  console.log(`[scrape] status=${resp.status}`);

  if (!resp.ok) throw new Error(`PAGE_HTTP_${resp.status}`);

  const html = await resp.text();
  console.log(`[scrape] HTML length=${html.length}`);

  const marker = "var ytInitialPlayerResponse = ";
  const idx = html.indexOf(marker);
  if (idx === -1) {
    console.error(`[scrape] No ytInitialPlayerResponse found`);
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
        console.log(`[scrape] trackCount=${tracks.length}`);
        return tracks;
      }
    }
  }

  throw new Error("PAGE_PARSE_ERROR");
}

/* ------------------------------------------------------------------ */
/*  Fetch + parse timedtext XML                                        */
/* ------------------------------------------------------------------ */

async function fetchTimedtextXml(baseUrl: string): Promise<string> {
  console.log(`[timedtext] GET ${baseUrl.substring(0, 120)}...`);

  const resp = await fetch(baseUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  console.log(`[timedtext] status=${resp.status}`);

  if (!resp.ok) throw new Error(`TIMEDTEXT_HTTP_${resp.status}`);

  const xml = await resp.text();
  console.log(`[timedtext] body length=${xml.length}`);

  if (!xml || xml.length === 0) throw new Error("TIMEDTEXT_EMPTY");

  return xml;
}

/* ------------------------------------------------------------------ */
/*  XML parsing                                                        */
/* ------------------------------------------------------------------ */

function parseTranscriptXml(xml: string, _lang: string): TranscriptEntry[] {
  const srv3Results = parseSrv3(xml);
  if (srv3Results.length > 0) {
    console.log(`[parse] srv3: ${srv3Results.length} entries`);
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
  console.log(`[parse] classic: ${results.length} entries`);
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
