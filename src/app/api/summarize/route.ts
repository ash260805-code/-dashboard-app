import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { extractVideoId, fetchTranscript } from "@/lib/youtube";

const MAX_SCREENSHOTS = 5;
const MAX_CHARS = 30000;

const SUMMARY_PROMPT_PREFIX = `You are an expert educational content creator. Analyze the following content and produce two sections:

## SUMMARY
Write a clear, concise summary in 3-5 sentences. Capture the main topic, key arguments, and conclusion.

## STUDY NOTES
Create well-organized study notes. Format them as:
- Use clear headings for each major topic
- Use bullet points for key concepts
- Include important definitions, formulas, or facts
- Highlight any examples or case studies mentioned
- Add a "Key Takeaways" section at the end with 3-5 main points

Make the notes clean, scannable, and useful for revision.`;

function parseAIResponse(text: string) {
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

    return { summary, notes };
}

async function callOpenRouter(
    messages: any[],
    apiKey: string,
    referer: string
) {
    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": referer,
        },
        body: JSON.stringify({
            model: "google/gemini-2.0-flash-001",
            messages,
        }),
        cache: "no-store",
    });

    if (!aiRes.ok) {
        const errBody = await aiRes.text();
        throw new Error(`OpenRouter returned ${aiRes.status}: ${errBody}`);
    }

    const aiData = await aiRes.json();
    const text = aiData.choices?.[0]?.message?.content || "";
    if (!text) throw new Error("AI returned an empty response");
    return text;
}

// ─── URL Mode ────────────────────────────────────────────────────────────────
async function handleUrlMode(videoUrl: string, apiKey: string, referer: string) {
    if (!videoUrl) {
        return NextResponse.json(
            { error: "Please provide a YouTube video URL." },
            { status: 400 }
        );
    }

    const videoId = await extractVideoId(videoUrl);
    if (!videoId) {
        return NextResponse.json(
            { error: "Invalid YouTube URL. Please paste a valid YouTube video link." },
            { status: 400 }
        );
    }

    let transcriptText: string;
    try {
        transcriptText = await fetchTranscript(videoId);
    } catch (err: any) {
        console.error("[Summarize] Transcript error:", err.message);
        return NextResponse.json({ error: err.message }, { status: 422 });
    }

    if (!transcriptText || transcriptText.trim().length < 50) {
        return NextResponse.json(
            { error: "The video transcript is too short to summarize." },
            { status: 422 }
        );
    }

    const truncated =
        transcriptText.length > MAX_CHARS
            ? transcriptText.substring(0, MAX_CHARS) + "..."
            : transcriptText;

    const text = await callOpenRouter(
        [{ role: "user", content: `${SUMMARY_PROMPT_PREFIX}\n\nTRANSCRIPT:\n${truncated}` }],
        apiKey,
        referer
    );

    const { summary, notes } = parseAIResponse(text);
    return NextResponse.json({ summary, notes, videoId });
}

// ─── Transcript Mode ─────────────────────────────────────────────────────────
async function handleTranscriptMode(
    transcriptText: string,
    apiKey: string,
    referer: string
) {
    if (!transcriptText || transcriptText.trim().length < 20) {
        return NextResponse.json(
            { error: "Please paste a transcript with at least 20 characters." },
            { status: 400 }
        );
    }

    const truncated =
        transcriptText.length > MAX_CHARS
            ? transcriptText.substring(0, MAX_CHARS) + "..."
            : transcriptText;

    const text = await callOpenRouter(
        [{ role: "user", content: `${SUMMARY_PROMPT_PREFIX}\n\nTRANSCRIPT:\n${truncated}` }],
        apiKey,
        referer
    );

    const { summary, notes } = parseAIResponse(text);
    return NextResponse.json({ summary, notes });
}

// ─── Screenshot Mode ─────────────────────────────────────────────────────────
async function handleScreenshotMode(
    screenshots: string[],
    apiKey: string,
    referer: string
) {
    if (!screenshots || !Array.isArray(screenshots) || screenshots.length === 0) {
        return NextResponse.json(
            { error: "Please upload at least one screenshot." },
            { status: 400 }
        );
    }

    if (screenshots.length > MAX_SCREENSHOTS) {
        return NextResponse.json(
            { error: `You can upload a maximum of ${MAX_SCREENSHOTS} screenshots.` },
            { status: 400 }
        );
    }

    // Build multimodal content parts
    const contentParts: any[] = [
        {
            type: "text",
            text: `${SUMMARY_PROMPT_PREFIX}\n\nBelow are screenshots from a video or educational content. Extract all visible text and information from these images, then produce the summary and study notes.`,
        },
    ];

    for (const base64Image of screenshots) {
        // Support both raw base64 and data-URI format
        let imageData = base64Image;
        let mimeType = "image/png";

        if (base64Image.startsWith("data:")) {
            const match = base64Image.match(/^data:(image\/\w+);base64,(.+)$/);
            if (match) {
                mimeType = match[1];
                imageData = match[2];
            }
        }

        contentParts.push({
            type: "image_url",
            image_url: {
                url: `data:${mimeType};base64,${imageData}`,
            },
        });
    }

    const text = await callOpenRouter(
        [{ role: "user", content: contentParts }],
        apiKey,
        referer
    );

    const { summary, notes } = parseAIResponse(text);
    return NextResponse.json({ summary, notes });
}

// ─── Main POST Handler ──────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json(
                { error: "You must be logged in to use this feature." },
                { status: 401 }
            );
        }

        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            console.error("[Summarize] OPENROUTER_API_KEY is not set!");
            return NextResponse.json(
                { error: "AI service is not configured. Please contact the administrator." },
                { status: 500 }
            );
        }

        const body = await request.json();
        const mode = body.mode || "url";
        const referer =
            request.headers.get("referer") || "https://dashboard-app.vercel.app";

        console.log(`[Summarize] Mode: ${mode}`);

        switch (mode) {
            case "url":
                return await handleUrlMode(body.videoUrl, apiKey, referer);

            case "transcript":
                return await handleTranscriptMode(body.transcriptText, apiKey, referer);

            case "screenshot":
                return await handleScreenshotMode(body.screenshots, apiKey, referer);

            default:
                return NextResponse.json(
                    { error: `Unknown mode: ${mode}` },
                    { status: 400 }
                );
        }
    } catch (error: any) {
        console.error("[Summarize] API Route Error:", error);
        if (error instanceof Error) console.error(error.stack);

        return NextResponse.json(
            {
                error:
                    error.message ||
                    "An unexpected error occurred. Please try again later.",
            },
            { status: 500 }
        );
    }
}
