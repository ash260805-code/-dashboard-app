import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { extractVideoId, fetchTranscript } from "@/lib/youtube";


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
                cache: "no-store",
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
        console.error("[Summarize] API Route Error:", error);
        // Log the full error object for debugging
        if (error instanceof Error) {
            console.error(error.stack);
        }

        return NextResponse.json(
            { error: error.message || "An unexpected error occurred. Please try again later." },
            { status: 500 }
        );
    }
}
