import { create } from 'youtube-dl-exec';
import path from 'path';

// Initialize youtube-dl-exec
// We use 'yt-dlp' binary which is what this wrapper uses by default mostly, 
// or it downloads it. 
const youtubedl = create(path.join(process.cwd(), 'bin', 'yt-dlp'));

/**
 * Fetch transcript using yt-dlp (via youtube-dl-exec)
 * This is the most robust method as yt-dlp is constantly updated.
 */
export async function fetchTranscript(videoId: string): Promise<string> {
    console.log(`[Transcript] Fetching for videoId: ${videoId} using yt-dlp`);
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    try {
        // 1. Fetch subtitles using yt-dlp
        // We ask for auto-generated subs (writeAutoSub) and skip invalid subs
        const output = await youtubedl(videoUrl, {
            skipDownload: true,
            writeAutoSub: true,
            writeSub: true,
            subLang: 'en',
            output: '-', // Stdout
            noWarnings: true,
            // We actually need the subtitle CONTENT, not just the file.
            // youtube-dl-exec usually executes the command. 
            // Getting the actual subtitle text via stdout is tricky because 
            // yt-dlp writes to files by default.
            // simpler approach: use --dump-json to get the caption URL or 
            // use --get-url for subs? No, yt-dlp doesn't stream subs to stdout easily.
        });

        // WAIT. youtube-dl-exec wrapper is for running the binary.
        // Getting the transcript text directly from stdout requires specific flags.
        // A better approach for nodejs integration might be to use the json dump
        // and fetch the caption URL, OR just trust python to do it.

        // Let's try a simpler approach compatible with Vercel limitations too (if using API).
        // BUT user asked for yt-dlp specifically.

        // Alternative: Use `youtube-dl-exec` to dump JSON, find the caption URL, and fetch it.
        // This avoids writing files to disk (which is read-only on Vercel serverless).

        const rawJson: any = await youtubedl(videoUrl, {
            dumpSingleJson: true,
            skipDownload: true,
            noWarnings: true,
        });

        // Parse JSON to find captions
        const automaticCaptions = rawJson.automatic_captions || {};
        const captions = rawJson.subtitles || {};

        // Prioritize manual English subs, then auto English
        const enSubs = captions.en || automaticCaptions.en || [];

        if (!enSubs || enSubs.length === 0) {
            throw new Error("No English captions found.");
        }

        // Get the first available format (usually vtt or srv3)
        // json dump provides a 'url' for the caption track
        const track = enSubs.find((t: any) => t.ext === 'vtt' || t.ext === 'srv3' || t.ext === 'ttml') || enSubs[0];

        if (!track || !track.url) {
            throw new Error("No caption URL found.");
        }

        console.log(`[Transcript] Found caption URL: ${track.url.substring(0, 50)}...`);

        // Fetch the caption content
        const res = await fetch(track.url);
        if (!res.ok) throw new Error(`Failed to fetch caption content: ${res.status}`);

        const textData = await res.text();

        // Parse the VTT/XML/SRT data to plain text
        // This is a simple parser, might need more robustness
        return cleanSubtitleText(textData);

    } catch (error: any) {
        console.error("[Transcript] yt-dlp failed:", error.message);
        throw new Error(`Failed to fetch transcript via yt-dlp: ${error.message}`);
    }
}

/**
 * Helper to clean up VTT/XML/SRTv subtitles into plain text
 */
function cleanSubtitleText(rawData: string): string {
    // 1. Remove XML tags (if srv3/ttml)
    let text = rawData.replace(/<[^>]*>/g, ' ');

    // 2. Remove VTT timestamps (00:00:00.000 --> 00:00:00.000)
    text = text.replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}.*/g, ' ');

    // 3. Remove WEBVTT headers and metadata
    text = text.replace(/WEBVTT/g, '');
    text = text.replace(/Kind: captions/g, '');
    text = text.replace(/Language: .*/g, '');

    // 4. Remove align/position signals
    text = text.replace(/align:start position:.*?%/g, '');

    // 5. Cleanup whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // 6. Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');

    return text;
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
