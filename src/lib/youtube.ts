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
    console.log(`[Transcript] Fetching for videoId: ${videoId} using standalone yt-dlp at ${binaryPath}`);
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    try {
        // Build the command with explicit quoting for paths with spaces
        const quotedBinary = `"${binaryPath}"`;
        const flags = [
            '--dump-single-json',
            '--skip-download',
            '--no-warnings',
            '--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"',
            '--extractor-args "youtube:player_client=android"'
        ].join(' ');

        const command = `${quotedBinary} ${flags} "${videoUrl}"`;
        console.log(`[Transcript] Executing: ${command}`);

        const stdout = execSync(command, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
        const rawJson = JSON.parse(stdout);

        // Parse JSON to find captions
        const automaticCaptions = rawJson.automatic_captions || {};
        const captions = rawJson.subtitles || {};

        // Prioritize manual English subs, then auto English
        const enSubs = (captions && captions.en) || (automaticCaptions && automaticCaptions.en) || [];

        if (!enSubs || enSubs.length === 0) {
            throw new Error("No English captions found.");
        }

        // Get the first available format (usually vtt or srv3)
        const track = enSubs.find((t: any) => t.ext === 'vtt' || t.ext === 'srv3' || t.ext === 'ttml') || enSubs[0];

        if (!track || !track.url) {
            throw new Error("No caption URL found.");
        }

        console.log(`[Transcript] Found caption URL: ${track.url.substring(0, 50)}...`);

        // Fetch the caption content
        const res = await fetch(track.url);
        if (!res.ok) throw new Error(`Failed to fetch caption content: ${res.status}`);

        const textData = await res.text();
        return cleanSubtitleText(textData);

    } catch (error: any) {
        console.error("[Transcript] yt-dlp failed:");
        const stderr = error.stderr?.toString() || "";
        console.error("Stderr:", stderr || "No stderr");
        console.error("Message:", error.message);

        if (stderr.includes("Sign in to confirm you’re not a bot")) {
            throw new Error("YouTube has blocked the request due to bot detection. Try again later or use a different video.");
        }

        throw new Error(`Failed to fetch transcript: ${stderr || error.message || "Unknown error"}`);
    }
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
