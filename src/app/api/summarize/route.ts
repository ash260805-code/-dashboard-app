import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

function extractVideoId(url: string): string | null {
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
            const playerRes = await fetch(
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

            const captRes = await fetch(track.baseUrl, {
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

    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Cookie": "CONSENT=YES+yt.453767867.en+FP+XXXXXXXXXX",
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
    const captRes = await fetch(track.baseUrl, {
        headers: {
            "User-Agent": mobileUA,
            "Cookie": cookies.join("; "),
        },
    });

    const xml = await captRes.text();
    if (!xml || xml.length === 0) {
        // Try with browser UA
        const captRes2 = await fetch(track.baseUrl, {
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
    ];

    console.log(`[Transcript] Trying Piped fallback (${instances.length} instances parallel)...`);

    // Helper to fetch from a single instance
    const fetchOne = async (instance: string): Promise<string> => {
        try {
            const res = await fetch(`${instance}/streams/${videoId}`, {
                signal: AbortSignal.timeout(8000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            const subtitles = data.subtitles;
            if (!subtitles || !Array.isArray(subtitles) || subtitles.length === 0) throw new Error("No subtitles");

            const enTrack = subtitles.find((s: any) => s.code === "en" || s.code?.startsWith("en") || s.name?.toLowerCase().includes("english"));
            const track = enTrack || subtitles[0];

            const subRes = await fetch(track.url, { signal: AbortSignal.timeout(8000) });
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
    ];

    console.log(`[Transcript] Trying Invidious fallback (${instances.length} instances parallel)...`);

    // Helper to fetch from a single instance
    const fetchOne = async (instance: string): Promise<string> => {
        try {
            // Step 1: Get caption tracks
            const res = await fetch(`${instance}/api/v1/captions/${videoId}`, {
                signal: AbortSignal.timeout(8000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const tracks = await res.json();
            if (!Array.isArray(tracks) || tracks.length === 0) throw new Error("No caption tracks");

            // Step 2: Find English track
            const enTrack = tracks.find((t: any) => t.languageCode === "en" || t.languageCode?.startsWith("en"));
            const track = enTrack || tracks[0];

            // Step 3: Fetch content
            const contentUrl = `${instance}${track.url}`;
            const subRes = await fetch(contentUrl, {
                signal: AbortSignal.timeout(8000),
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
 * Master transcript fetcher: tries multiple methods in sequence.
 */
async function fetchTranscript(videoId: string): Promise<string> {
    const debugLogs: string[] = [];

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

    // Capture logs in server console for admins
    console.error("Transcript Fetch Failure Logs:", JSON.stringify(debugLogs, null, 2));

    // Throw a detailed error for the user to share
    const logStr = debugLogs.join(" | ").substring(0, 300); // Truncate for UI
    throw new Error(
        `Failed to fetch transcript. Debug: [${logStr}...]`
    );
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json(
                { error: "You must be logged in to use this feature." },
                { status: 401 }
            );
        }

        if (!process.env.OPENROUTER_API_KEY) {
            console.error("[Summarize] OPENROUTER_API_KEY is not set!");
            return NextResponse.json(
                { error: "AI service is not configured. Please contact the administrator." },
                { status: 500 }
            );
        }

        const { videoUrl } = await request.json();

        if (!videoUrl) {
            return NextResponse.json(
                { error: "Please provide a YouTube video URL." },
                { status: 400 }
            );
        }

        const videoId = extractVideoId(videoUrl);
        if (!videoId) {
            return NextResponse.json(
                { error: "Invalid YouTube URL. Please paste a valid YouTube video link." },
                { status: 400 }
            );
        }

        // Fetch transcript
        let transcriptText: string;
        try {
            transcriptText = await fetchTranscript(videoId);
        } catch (err: any) {
            console.error("[Summarize] Transcript error:", err.message);
            // Return 422 with the exact error message (containing debug logs)
            return NextResponse.json(
                { error: err.message },
                { status: 422 }
            );
        }

        if (!transcriptText || transcriptText.trim().length < 50) {
            return NextResponse.json(
                { error: "The video transcript is too short to summarize." },
                { status: 422 }
            );
        }

        // Truncate if too long
        const maxChars = 30000;
        const truncated =
            transcriptText.length > maxChars
                ? transcriptText.substring(0, maxChars) + "..."
                : transcriptText;

        // Generate summary via OpenRouter API
        let text: string;
        try {
            console.log("[Summarize] Calling OpenRouter API...");

            const prompt = `You are an expert educational content creator. Analyze the following YouTube video transcript and produce two sections:

## SUMMARY
Write a clear, concise summary of the video in 3-5 sentences. Capture the main topic, key arguments, and conclusion.

## STUDY NOTES
Create well-organized study notes from this video. Format them as:
- Use clear headings for each major topic
- Use bullet points for key concepts
- Include important definitions, formulas, or facts
- Highlight any examples or case studies mentioned
- Add a "Key Takeaways" section at the end with 3-5 main points

Make the notes clean, scannable, and useful for revision.

TRANSCRIPT:
${truncated}`;

            const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "HTTP-Referer": request.headers.get("referer") || "https://dashboard-app.vercel.app",
                },
                body: JSON.stringify({
                    model: "google/gemini-2.0-flash-001",
                    messages: [
                        { role: "user", content: prompt },
                    ],
                }),
            });

            if (!aiRes.ok) {
                const errBody = await aiRes.text();
                throw new Error(`OpenRouter returned ${aiRes.status}: ${errBody}`);
            }

            const aiData = await aiRes.json();
            text = aiData.choices?.[0]?.message?.content || "";
            console.log(`[Summarize] OpenRouter returned ${text.length} chars`);

            if (!text) {
                throw new Error("AI returned an empty response");
            }
        } catch (aiErr: any) {
            console.error("[Summarize] AI API error:", aiErr.message || aiErr);
            return NextResponse.json(
                {
                    error: `AI summarization failed: ${aiErr.message || "Unknown error"}. Please try again later.`,
                },
                { status: 500 }
            );
        }

        // Parse the AI response
        let summary = "";
        let notes = "";

        const summaryMatch = text.match(
            /(?:#+\s*SUMMARY|Summary:?)\s*([\s\S]*?)(?=#+\s*STUDY NOTES|Study Notes:?|$)/i
        );
        const notesMatch = text.match(
            /(?:#+\s*STUDY NOTES|Study Notes:?)\s*([\s\S]*)/i
        );

        if (summaryMatch && summaryMatch[1].trim()) {
            summary = summaryMatch[1].trim();
        } else {
            const paragraphs = text.split(/\n\s*\n/);
            summary = paragraphs.slice(0, 2).join("\n\n").trim();
        }

        if (notesMatch && notesMatch[1].trim()) {
            notes = notesMatch[1].trim();
        } else {
            notes = text;
        }

        return NextResponse.json({ summary, notes, videoId });
    } catch (error: any) {
        console.error("[Summarize] Unexpected error:", error.message || error);
        return NextResponse.json(
            { error: `An unexpected error occurred: ${error.message || "Unknown error"}. Please try again later.` },
            { status: 500 }
        );
    }
}
