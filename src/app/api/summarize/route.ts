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
 * Fetch transcript using the Innertube player API with multiple client types.
 * The ANDROID client with a mobile User-Agent is the most reliable approach
 * for fetching captions from any environment (local, Vercel, etc.).
 */
async function fetchTranscript(videoId: string): Promise<string> {
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
            console.log(`[Summarize] Trying ${client.name} client...`);

            // Step 1: Get player data
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

            if (!playerRes.ok) {
                throw new Error(`Player API returned ${playerRes.status}`);
            }

            const playerData = await playerRes.json();
            const status = playerData?.playabilityStatus?.status;

            if (status !== "OK") {
                const reason = playerData?.playabilityStatus?.reason || "Not playable";
                throw new Error(`Video not playable: ${reason}`);
            }

            // Step 2: Get caption tracks
            const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

            if (!tracks || tracks.length === 0) {
                throw new Error("No captions available");
            }

            console.log(`[Summarize] Found ${tracks.length} caption tracks`);

            // Prefer English, then first available
            const englishTrack = tracks.find(
                (t: any) => t.languageCode === "en" || t.languageCode?.startsWith("en")
            );
            const selectedTrack = englishTrack || tracks[0];

            // Step 3: Fetch caption content with the SAME mobile User-Agent
            const captionRes = await fetch(selectedTrack.baseUrl, {
                headers: { "User-Agent": client.ua },
            });

            if (!captionRes.ok) {
                throw new Error(`Caption fetch returned ${captionRes.status}`);
            }

            const xml = await captionRes.text();

            if (!xml || xml.length === 0) {
                throw new Error("Caption response was empty");
            }

            // Step 4: Parse the XML
            const transcript = parseCaptionXml(xml);

            if (!transcript || transcript.length < 10) {
                throw new Error("Could not parse caption content");
            }

            console.log(`[Summarize] ✓ Got ${transcript.length} chars via ${client.name}`);
            return transcript;
        } catch (err: any) {
            const msg = `${client.name}: ${err.message}`;
            console.warn(`[Summarize] ✗ ${msg}`);
            errors.push(msg);
        }
    }

    // All clients failed
    console.error(`[Summarize] All clients failed: ${errors.join(" | ")}`);
    throw new Error(
        "This video does not have captions available or it's restricted. Please try a different YouTube link that has captions/subtitles."
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
                    "HTTP-Referer": "http://localhost:3000",
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
