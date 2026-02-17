import { Innertube, UniversalCache } from 'youtubei.js';

// Cache instance for Innertube
let innertube: Innertube | null = null;

// Initialize Innertube
async function getInnertube() {
    if (!innertube) {
        innertube = await Innertube.create({
            cache: new UniversalCache(false),
            generate_session_locally: true,
        });
    }
    return innertube;
}

/**
 * Fetch transcript using youtubei.js (Innertube)
 * This is a pure JS solution that works on Vercel without external binaries.
 */
export async function fetchTranscript(videoId: string): Promise<string> {
    console.log(`[Transcript] Fetching for videoId: ${videoId} using Innertube`);

    try {
        const youtube = await getInnertube();
        const info = await youtube.getInfo(videoId);

        const transcriptData = await info.getTranscript();

        if (!transcriptData?.transcript?.content?.body?.initial_segments) {
            throw new Error("No transcript found for this video.");
        }

        // Extract and join text
        const segments = transcriptData.transcript.content.body.initial_segments;

        // Map segments to text and join
        const fullText = segments
            // @ts-ignore
            .map((seg: any) => seg.snippet.text)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (!fullText) {
            throw new Error("Transcript content is empty.");
        }

        return fullText;

    } catch (error: any) {
        console.error("[Transcript] Innertube failed:", error.message);
        throw new Error(`Failed to fetch transcript: ${error.message}`);
    }
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
