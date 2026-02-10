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
    // Fetch the YouTube video page to get caption track info
    const videoPageResponse = await fetch(
        `https://www.youtube.com/watch?v=${videoId}`,
        {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9",
            },
        }
    );

    if (!videoPageResponse.ok) {
        throw new Error("Failed to fetch video page");
    }

    const html = await videoPageResponse.text();

    // Extract captions JSON from the page
    const captionMatch = html.match(/"captions":\s*(\{[\s\S]*?"playerCaptionsTracklistRenderer"[\s\S]*?\})\s*,\s*"videoDetails"/);

    if (!captionMatch) {
        // Try alternative pattern
        const altMatch = html.match(/"captionTracks":\s*(\[[\s\S]*?\])/);
        if (!altMatch) {
            throw new Error("No captions found");
        }

        try {
            const tracks = JSON.parse(altMatch[1]);
            if (tracks.length === 0) throw new Error("No caption tracks");

            const captionUrl = tracks[0].baseUrl;
            return await fetchCaptionContent(captionUrl);
        } catch {
            throw new Error("Failed to parse caption tracks");
        }
    }

    try {
        const captionsData = JSON.parse(captionMatch[1]);
        const tracks = captionsData?.playerCaptionsTracklistRenderer?.captionTracks;

        if (!tracks || tracks.length === 0) {
            throw new Error("No caption tracks available");
        }

        // Prefer English, fallback to first available
        const englishTrack = tracks.find(
            (t: { languageCode: string }) => t.languageCode === "en" || t.languageCode?.startsWith("en")
        );
        const selectedTrack = englishTrack || tracks[0];
        const captionUrl = selectedTrack.baseUrl;

        return await fetchCaptionContent(captionUrl);
    } catch {
        throw new Error("Failed to parse captions data");
    }
}

async function fetchCaptionContent(captionUrl: string): Promise<string> {
    const captionResponse = await fetch(captionUrl);
    if (!captionResponse.ok) {
        throw new Error("Failed to fetch caption content");
    }

    const captionXml = await captionResponse.text();

    // Parse the XML to extract text
    const textSegments: string[] = [];
    const regex = /<text[^>]*>([\s\S]*?)<\/text>/g;
    let match;

    while ((match = regex.exec(captionXml)) !== null) {
        // Decode HTML entities
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

        // Fetch transcript using custom fetcher
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
