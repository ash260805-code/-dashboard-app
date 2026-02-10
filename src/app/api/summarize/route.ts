import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

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

async function fetchTranscript(videoId: string): Promise<string> {
    // Step 1: Fetch the YouTube video page with consent cookie to bypass cookie wall
    const videoPageResponse = await fetch(
        `https://www.youtube.com/watch?v=${videoId}`,
        {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Cookie": "CONSENT=PENDING+987; SOCS=CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjMxMjE5LjA3X3AxGgJlbiACGgYIgJnsBhAB",
            },
        }
    );

    if (!videoPageResponse.ok) {
        throw new Error(`Failed to fetch video page: ${videoPageResponse.status}`);
    }

    const html = await videoPageResponse.text();

    // Step 2: Extract ytInitialPlayerResponse JSON from the page
    const playerResponseMatch = html.match(/var ytInitialPlayerResponse\s*=\s*(\{.+?\});/);

    let captionUrl: string | null = null;

    if (playerResponseMatch) {
        try {
            const playerResponse = JSON.parse(playerResponseMatch[1]);
            const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

            if (tracks && tracks.length > 0) {
                // Prefer English, fallback to first available
                const englishTrack = tracks.find(
                    (t: { languageCode: string }) =>
                        t.languageCode === "en" || t.languageCode?.startsWith("en")
                );
                captionUrl = (englishTrack || tracks[0]).baseUrl;
            }
        } catch {
            // JSON parse failed, try regex fallback
        }
    }

    // Step 3: Fallback — try to find captionTracks directly
    if (!captionUrl) {
        const trackMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
        if (trackMatch) {
            try {
                const tracks = JSON.parse(trackMatch[1]);
                if (tracks.length > 0) {
                    const englishTrack = tracks.find(
                        (t: { languageCode: string }) =>
                            t.languageCode === "en" || t.languageCode?.startsWith("en")
                    );
                    captionUrl = (englishTrack || tracks[0]).baseUrl;
                }
            } catch {
                // parse failed
            }
        }
    }

    // Step 4: Another fallback — find baseUrl for timedtext
    if (!captionUrl) {
        const timedTextMatch = html.match(/"baseUrl"\s*:\s*"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]+)"/);
        if (timedTextMatch) {
            captionUrl = timedTextMatch[1].replace(/\\u0026/g, "&");
        }
    }

    if (!captionUrl) {
        throw new Error("No captions found for this video");
    }

    // Decode any escaped characters in the URL
    captionUrl = captionUrl.replace(/\\u0026/g, "&").replace(/\\u003d/g, "=");

    // Step 5: Fetch the caption content
    const captionResponse = await fetch(captionUrl, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
    });

    if (!captionResponse.ok) {
        throw new Error(`Failed to fetch captions: ${captionResponse.status}`);
    }

    const captionXml = await captionResponse.text();

    // Step 6: Parse the XML to extract text
    const textSegments: string[] = [];
    const regex = /<text[^>]*>([\s\S]*?)<\/text>/g;
    let match;

    while ((match = regex.exec(captionXml)) !== null) {
        let text = match[1]
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\n/g, " ")
            .trim();

        if (text) {
            textSegments.push(text);
        }
    }

    if (textSegments.length === 0) {
        throw new Error("No text found in captions");
    }

    return textSegments.join(" ");
}

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const session = await auth();
        if (!session) {
            return NextResponse.json(
                { error: "You must be logged in to use this feature." },
                { status: 401 }
            );
        }

        const { videoUrl } = await request.json();

        if (!videoUrl) {
            return NextResponse.json(
                { error: "Please provide a YouTube video URL." },
                { status: 400 }
            );
        }

        // Extract video ID
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
        } catch (err) {
            console.error("Transcript fetch error:", err);
            return NextResponse.json(
                {
                    error:
                        "Could not fetch video transcript. This video may not have captions/subtitles available, or it may be restricted. Please try a different video.",
                },
                { status: 422 }
            );
        }

        if (!transcriptText || transcriptText.trim().length < 50) {
            return NextResponse.json(
                { error: "The video transcript is too short to summarize." },
                { status: 422 }
            );
        }

        // Truncate transcript if too long (Gemini has token limits)
        const maxChars = 30000;
        const truncatedTranscript =
            transcriptText.length > maxChars
                ? transcriptText.substring(0, maxChars) + "..."
                : transcriptText;

        // Generate summary and notes with Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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
${truncatedTranscript}`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // Split the response into summary and notes
        const summaryMatch = text.match(/## SUMMARY\s*([\s\S]*?)(?=## STUDY NOTES)/i);
        const notesMatch = text.match(/## STUDY NOTES\s*([\s\S]*)/i);

        const summary = summaryMatch ? summaryMatch[1].trim() : text.substring(0, 500);
        const notes = notesMatch ? notesMatch[1].trim() : text;

        return NextResponse.json({
            summary,
            notes,
            videoId,
        });
    } catch (error) {
        console.error("Summarize API error:", error);
        return NextResponse.json(
            { error: "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}
