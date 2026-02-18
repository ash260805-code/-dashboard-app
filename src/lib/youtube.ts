import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// Determine binary path based on platform
const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
// Use the 'bin' directory in project root
const binaryPath = path.join(process.cwd(), 'bin', binaryName);

// Ensure execution permissions (just in case)
if (process.platform !== 'win32' && fs.existsSync(binaryPath)) {
    try {
        fs.chmodSync(binaryPath, '755');
    } catch (e) {
        // Ignore error if we can't chmod (e.g. read-only fs), mostly for local dev
    }
}

export async function fetchTranscript(videoId: string): Promise<string> {
    console.log(`[Transcript] Fetching for videoId: ${videoId} using standalone yt-dlp. Binary: ${binaryPath}`);
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Order of clients to try: Android is standard, IOS is more stealthy, web_creator is Studio-level
    const clients = ['android', 'ios', 'web_creator'];
    let lastErrorMessage = "";

    for (const client of clients) {
        try {
            console.log(`[Transcript] Attempting with client: ${client}...`);
            const quotedBinary = `"${binaryPath}"`;
            const flags = [
                '--dump-single-json',
                '--skip-download',
                '--no-warnings',
                '--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"',
                `--extractor-args "youtube:player_client=${client}"`
            ].join(' ');

            const command = `${quotedBinary} ${flags} "${videoUrl}"`;
            const stdout = execSync(command, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
            const rawJson = JSON.parse(stdout);

            const automaticCaptions = rawJson.automatic_captions || {};
            const captions = rawJson.subtitles || {};
            const enSubs = (captions && captions.en) || (automaticCaptions && automaticCaptions.en) || [];

            if (!enSubs || enSubs.length === 0) {
                console.warn(`[Transcript] Client ${client} found no English subtitles.`);
                continue;
            }

            const track = enSubs.find((t: any) => t.ext === 'vtt' || t.ext === 'srv3' || t.ext === 'ttml') || enSubs[0];

            if (!track || !track.url) {
                console.warn(`[Transcript] Client ${client} found subtitles but no download URL.`);
                continue;
            }

            console.log(`[Transcript] Success with ${client}! Fetching caption content...`);
            const res = await fetch(track.url);
            if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

            const textData = await res.text();
            return cleanSubtitleText(textData);

        } catch (error: any) {
            const stderr = error.stderr?.toString() || "";
            lastErrorMessage = stderr || error.message || "Unknown error";
            console.error(`[Transcript] Client ${client} failed: ${lastErrorMessage.substring(0, 100)}...`);

            // Proceed to next client
            continue;
        }
    }

    // If we reach here, all clients failed
    if (lastErrorMessage.includes("Sign in to confirm you’re not a bot")) {
        throw new Error("YouTube has blocked the request due to heavy traffic from Vercel's data center. Try again later or use a different video.");
    }

    throw new Error(`Failed to fetch transcript (tried ${clients.length} stealth clients): ${lastErrorMessage}`);
}

/**
 * Helper to clean up VTT/XML/SRTv subtitles into plain text
 */
function cleanSubtitleText(rawData: string): string {
    let text = rawData.replace(/<[^>]*>/g, ' ');
    text = text.replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}.*/g, ' ');
    text = text.replace(/WEBVTT/g, '');
    text = text.replace(/Kind: captions/g, '');
    text = text.replace(/Language: .*/g, '');
    text = text.replace(/align:start position:.*?%/g, '');
    text = text.replace(/\s+/g, ' ').trim();
    text = text.replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
    return text;
}

export async function extractVideoId(url: string): Promise<string | null> {
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
