
import { YoutubeTranscript } from "youtube-transcript";

// Robust fetch helper with no caching and browser headers
async function fetchWithNoCache(url: string, options: RequestInit = {}): Promise<Response> {
    const defaultHeaders: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
    };

    const inputHeaders = (options.headers as Record<string, string>) || {};
    const finalHeaders = { ...defaultHeaders, ...inputHeaders };

    // Inject cookies if available and not already present
    if (process.env.YOUTUBE_COOKIES && !finalHeaders["Cookie"]) {
        finalHeaders["Cookie"] = process.env.YOUTUBE_COOKIES;
    }

    return fetch(url, {
        ...options,
        headers: finalHeaders,
        cache: "no-store", // Critical for Vercel/Next.js
        next: { revalidate: 0 }, // For Next.js 13+
    } as RequestInit);
}

export function extractVideoId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
        /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

/**
 * Parse caption XML into plain text.
 * Handles <text>, <p>, and <s> tags, and strips nested HTML.
 */
function parseCaptionXml(xml: string): string {
    const textSegments: string[] = [];
    const regex = /<(?:text|p|s)[^>]*>([\s\S]*?)<\/(?:text|p|s)>/g;
    let match;

    while ((match = regex.exec(xml)) !== null) {
        const text = match[1]
            .replace(/<[^>]*>/g, "")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, " ")
            .replace(/\n/g, " ")
            .trim();

        if (text) {
            textSegments.push(text);
        }
    }

    return textSegments.join(" ");
}

/**
 * Method 0: youtube-transcript library
 * Uses internal API endpoint often less restricted than public ones.
 */
async function fetchViaLibrary(videoId: string): Promise<string> {
    console.log(`[Transcript] Trying youtube-transcript library...`);
    try {
        const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
            lang: "en",
        });

        if (!transcript || transcript.length === 0) {
            throw new Error("Empty transcript returned");
        }

        const text = transcript.map((item) => item.text).join(" ");
        console.log(`[Transcript] ✓ Library success: ${text.length} chars`);
        return text;
    } catch (e: any) {
        throw new Error(`Library failed: ${e.message}`);
    }
}

/**
 * Method 1: Innertube player API with multiple mobile clients.
 */
async function fetchViaInnertube(videoId: string): Promise<string> {
    const clients = [
        {
            name: "ANDROID",
            ua: "com.google.android.youtube/19.09.37 (Linux; U; Android 12; US) gzip",
            body: {
                videoId,
                context: {
                    client: {
                        clientName: "ANDROID",
                        clientVersion: "19.09.37",
                        androidSdkVersion: 31,
                        hl: "en",
                        gl: "US",
                    },
                },
                contentCheckOk: true,
                racyCheckOk: true,
            },
        },
        {
            name: "TV_EMBEDDED",
            ua: "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version",
            body: {
                videoId,
                context: {
                    client: {
                        clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
                        clientVersion: "2.0",
                        hl: "en",
                        gl: "US",
                    },
                    thirdParty: {
                        embedUrl: "https://www.google.com",
                    },
                },
                contentCheckOk: true,
                racyCheckOk: true,
            },
        },
        {
            name: "IOS",
            ua: "com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 17_0 like Mac OS X; en_US)",
            body: {
                videoId,
                context: {
                    client: {
                        clientName: "IOS",
                        clientVersion: "19.09.3",
                        deviceModel: "iPhone14,3",
                        hl: "en",
                        gl: "US",
                    },
                },
                contentCheckOk: true,
                racyCheckOk: true,
            },
        },
    ];

    const errors: string[] = [];

    for (const client of clients) {
        try {
            console.log(`[Transcript] Trying ${client.name}...`);
            const playerRes = await fetchWithNoCache(
                "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "User-Agent": client.ua,
                    },
                    body: JSON.stringify(client.body),
                }
            );

            if (!playerRes.ok) throw new Error(`HTTP ${playerRes.status}`);

            const data = await playerRes.json();
            const status = data?.playabilityStatus?.status;
            if (status !== "OK") {
                throw new Error(`${status}: ${data?.playabilityStatus?.reason || "blocked"}`);
            }

            const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            if (!tracks?.length) throw new Error("No caption tracks");

            console.log(`[Transcript] ${client.name}: ${tracks.length} tracks found`);

            // Prefer English
            const enTrack = tracks.find((t: any) => t.languageCode === "en" || t.languageCode?.startsWith("en"));
            const track = enTrack || tracks[0];

            const captRes = await fetchWithNoCache(track.baseUrl, {
                headers: { "User-Agent": client.ua },
            });
            const xml = await captRes.text();
            if (!xml || xml.length === 0) throw new Error("Empty caption response");

            const text = parseCaptionXml(xml);
            if (!text || text.length < 10) throw new Error("Failed to parse captions");

            console.log(`[Transcript] ✓ ${client.name}: ${text.length} chars`);
            return text;
        } catch (e: any) {
            console.warn(`[Transcript] ✗ ${client.name}: ${e.message}`);
            errors.push(`${client.name}: ${e.message}`);
        }
    }

    throw new Error(`Innertube failed: ${errors.join(" | ")}`);
}

/**
 * Method 2: Watch page scraping + caption URL fetch.
 * Falls back to extracting captions from the watch page's player response.
 */
async function fetchViaWatchPage(videoId: string): Promise<string> {
    console.log(`[Transcript] Trying watch page scrape...`);

    const res = await fetchWithNoCache(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        },
    });

    const html = await res.text();
    if (html.length < 10000) throw new Error("Watch page too small");

    // Extract player response
    const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (!playerMatch) throw new Error("No player response in page");

    const playerData = JSON.parse(playerMatch[1]);
    const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!tracks?.length) throw new Error("No captions in watch page");

    console.log(`[Transcript] Watch page: ${tracks.length} tracks`);

    // Prefer English
    const enTrack = tracks.find((t: any) => t.languageCode === "en" || t.languageCode?.startsWith("en"));
    const track = enTrack || tracks[0];

    // Fetch caption content with cookies from the page
    const cookies: string[] = ["CONSENT=YES+yt.453767867.en+FP+XXXXXXXXXX"];
    res.headers.forEach((value, key) => {
        if (key.toLowerCase() === "set-cookie") {
            cookies.push(value.split(";")[0]);
        }
    });

    // Try fetching with mobile UA (important: the caption server responds differently per UA)
    const mobileUA = "com.google.android.youtube/19.09.37 (Linux; U; Android 12; US) gzip";
    const captRes = await fetchWithNoCache(track.baseUrl, {
        headers: {
            "User-Agent": mobileUA,
            "Cookie": cookies.join("; "),
        },
    });

    const xml = await captRes.text();
    if (!xml || xml.length === 0) {
        // Try with browser UA
        const captRes2 = await fetchWithNoCache(track.baseUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Cookie": cookies.join("; "),
                "Referer": `https://www.youtube.com/watch?v=${videoId}`,
            },
        });
        const xml2 = await captRes2.text();
        if (!xml2 || xml2.length === 0) throw new Error("Caption content empty");
        const text = parseCaptionXml(xml2);
        if (!text || text.length < 10) throw new Error("Parse failed");
        return text;
    }

    const text = parseCaptionXml(xml);
    if (!text || text.length < 10) throw new Error("Parse failed");

    console.log(`[Transcript] ✓ Watch page: ${text.length} chars`);
    return text;
}

/**
 * Method 3: Piped API (Public Instances)
 * Piped is another privacy-friendly YouTube frontend with a stable API.
 */
async function fetchViaPiped(videoId: string): Promise<string> {
    const instances = [
        "https://pipedapi.kavin.rocks",
        "https://api.piped.privacy.com.de",
        "https://piped-api.lunar.icu",
        "https://pipedapi.drgns.space",
        "https://api.piped.yt",
        "https://piped-api.garudalinux.org",
        "https://pa.il.ax",
        "https://p.odyssey346.dev",
        "https://api.piped.projectsegfau.lt",
        "https://pipedapi.system41.xyz",
        "https://api.piped.zing.studio",
        "https://piped.video",
        "https://piped.tokhmi.xyz",
        "https://piped.moomoo.me",
        "https://piped.syncpundit.io",
        "https://piped.mha.fi",
    ];

    console.log(`[Transcript] Trying Piped fallback (${instances.length} instances parallel)...`);

    // Helper to fetch from a single instance
    const fetchOne = async (instance: string): Promise<string> => {
        try {
            // NOTE: We passing empty User-Agent to mimic API environment, 
            // as some Piped instances block browser UAs.
            const res = await fetchWithNoCache(`${instance}/streams/${videoId}`, {
                signal: AbortSignal.timeout(8000),
                headers: { "User-Agent": "" }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            const subtitles = data.subtitles;
            if (!subtitles || !Array.isArray(subtitles) || subtitles.length === 0) throw new Error("No subtitles");

            const enTrack = subtitles.find((s: any) => s.code === "en" || s.code?.startsWith("en") || s.name?.toLowerCase().includes("english"));
            const track = enTrack || subtitles[0];

            const subRes = await fetchWithNoCache(track.url, {
                signal: AbortSignal.timeout(8000),
                headers: { "User-Agent": "" }
            });
            if (!subRes.ok) throw new Error("Failed to fetch subtitle content");

            const text = await subRes.text();
            if (!text || text.length < 50) throw new Error("Empty subtitle content");

            return text
                .replace(/WEBVTT/g, "")
                .replace(/^\d+\s+$/gm, "")
                .replace(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}.*/g, "")
                .replace(/<[^>]*>/g, "")
                .replace(/\n+/g, " ")
                .trim();
        } catch (e: any) {
            throw new Error(`${instance}: ${e.message}`);
        }
    };

    // Race them all!
    try {
        const result = await Promise.any(instances.map(fetchOne));
        console.log(`[Transcript] ✓ Piped success`);
        return result;
    } catch (aggregateError: any) {
        // Log all errors
        const errors = (aggregateError as AggregateError).errors;
        const errMsgs = errors.map((e: any) => e.message).join(" | ");
        console.warn(`[Transcript] Piped all failed: ${errMsgs}`);
        throw new Error(`Piped failed: ${errMsgs}`);
    }
}

/**
 * Method 4: Invidious API (Public Instances)
 * Proxies requests through community-hosted instances to bypass IP blocks.
 */
async function fetchViaInvidious(videoId: string): Promise<string> {
    const instances = [
        "https://inv.tux.pizza",
        "https://invidious.flokinet.to",
        "https://invidious.projectsegfau.lt",
        "https://vid.puffyan.us",
        "https://yewtu.be",
        "https://yt.artemislena.eu",
        "https://invidious.privacydev.net",
        "https://iv.ggtyler.dev",
        "https://invidious.lunar.icu",
        "https://inv.nadeko.net",
        "https://invidious.protokolla.fi",
        "https://invidious.drgns.space",
        "https://invidious.jing.rocks",
        "https://invidious.nerdvpn.de",
    ];

    console.log(`[Transcript] Trying Invidious fallback (${instances.length} instances parallel)...`);

    // Helper to fetch from a single instance
    const fetchOne = async (instance: string): Promise<string> => {
        try {
            // Step 1: Get caption tracks
            // Use generic UA
            const res = await fetchWithNoCache(`${instance}/api/v1/captions/${videoId}`, {
                signal: AbortSignal.timeout(8000),
                headers: { "User-Agent": "" }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const tracks = await res.json();
            if (!Array.isArray(tracks) || tracks.length === 0) throw new Error("No caption tracks");

            // Step 2: Find English track
            const enTrack = tracks.find((t: any) => t.languageCode === "en" || t.languageCode?.startsWith("en"));
            const track = enTrack || tracks[0];

            // Step 3: Fetch content
            const contentUrl = `${instance}${track.url}`;
            const subRes = await fetchWithNoCache(contentUrl, {
                signal: AbortSignal.timeout(8000),
                headers: { "User-Agent": "" }
            });
            if (!subRes.ok) throw new Error("Failed to fetch caption content");

            const text = await subRes.text();
            if (!text || text.length < 50) throw new Error("Empty caption content");

            const cleanText = text
                .replace(/WEBVTT/g, "")
                .replace(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/g, "")
                .replace(/<[^>]*>/g, "")
                .replace(/\n+/g, " ")
                .trim();

            return cleanText;
        } catch (e: any) {
            throw new Error(`${instance}: ${e.message}`);
        }
    };

    // Race them all!
    try {
        const result = await Promise.any(instances.map(fetchOne));
        console.log(`[Transcript] ✓ Invidious success`);
        return result;
    } catch (aggregateError: any) {
        const errors = (aggregateError as AggregateError).errors;
        const errMsgs = errors.map((e: any) => e.message).join(" | ");
        console.warn(`[Transcript] Invidious all failed: ${errMsgs}`);
        throw new Error(`Invidious failed: ${errMsgs}`);
    }
}

/**
 * Method 5: Legacy Google Video API (The "Hail Mary")
 * Accesses safe/old timedtext endpoint.
 */
async function fetchViaLegacyApi(videoId: string): Promise<string> {
    console.log(`[Transcript] Trying Legacy API...`);
    try {
        const res = await fetchWithNoCache(`http://video.google.com/timedtext?lang=en&v=${videoId}`, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const xml = await res.text();
        if (!xml || xml.length < 20 || !xml.includes("<transcript>")) {
            throw new Error("Invalid XML response");
        }

        const text = parseCaptionXml(xml);
        if (!text || text.length < 10) throw new Error("Parse failed");

        console.log(`[Transcript] ✓ Legacy API: ${text.length} chars`);
        return text;
    } catch (e: any) {
        throw new Error(`Legacy API failed: ${e.message}`);
    }
}

/**
 * Master transcript fetcher: tries multiple methods in sequence.
 */
export async function fetchTranscript(videoId: string): Promise<string> {
    const debugLogs: string[] = [];

    // Method 0: Library (New Primary)
    try {
        return await fetchViaLibrary(videoId);
    } catch (e: any) {
        debugLogs.push(`Library: ${e.message}`);
        console.warn(`[Transcript] Library method failed: ${e.message}`);
    }

    // Method 1: Innertube API
    try {
        return await fetchViaInnertube(videoId);
    } catch (e: any) {
        const msg = e.message.length > 100 ? e.message.substring(0, 100) + "..." : e.message;
        debugLogs.push(`Innertube: ${msg}`);
        console.warn(`[Transcript] Innertube methods failed: ${msg}`);
    }

    // Method 2: Piped API (Parallel)
    try {
        return await fetchViaPiped(videoId);
    } catch (e: any) {
        const msg = e.message.length > 100 ? e.message.substring(0, 100) + "..." : e.message;
        debugLogs.push(`Piped: ${msg}`);
        console.warn(`[Transcript] Piped method failed: ${msg}`);
    }

    // Method 3: Invidious API (Parallel)
    try {
        return await fetchViaInvidious(videoId);
    } catch (e: any) {
        const msg = e.message.length > 100 ? e.message.substring(0, 100) + "..." : e.message;
        debugLogs.push(`Invidious: ${msg}`);
        console.warn(`[Transcript] Invidious method failed: ${msg}`);
    }

    // Method 4: Watch page scraping
    try {
        return await fetchViaWatchPage(videoId);
    } catch (e: any) {
        debugLogs.push(`WatchPage: ${e.message}`);
        console.warn(`[Transcript] Watch page method failed: ${e.message}`);
    }

    // Method 5: Legacy API
    try {
        return await fetchViaLegacyApi(videoId);
    } catch (e: any) {
        debugLogs.push(`LegacyAPI: ${e.message}`);
        console.warn(`[Transcript] Legacy method failed: ${e.message}`);
    }

    // Capture logs in server console for admins
    console.error("Transcript Fetch Failure Logs:", JSON.stringify(debugLogs, null, 2));

    // Throw a detailed error for the user to share
    const logStr = debugLogs.join(" | ").substring(0, 300); // Truncate for UI
    throw new Error(
        `Failed to fetch transcript. Debug: [${logStr}...]`
    );
}
