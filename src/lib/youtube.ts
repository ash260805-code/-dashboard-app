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

/**
 * Primary method: Manual HTML scraping (Fast & Stealthy)
 */
async function fetchManualTranscript(videoId: string): Promise<string> {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`[Transcript] Attempting Manual HTML Fetch for ${videoId}...`);

    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            cache: 'no-store'
        });

        const html = await res.text();
        const match = html.match(/"captionTracks":\s*(\[.*?\])/);

        if (!match) {
            if (html.includes('Sign in to confirm you’re not a bot')) {
                throw new Error("BOT_DETECTION");
            }
            throw new Error("NO_CAPTIONS_FOUND");
        }

        const tracks = JSON.parse(match[1]);
        const enTrack = tracks.find((t: any) => t.languageCode === 'en' || t.vssId?.includes('.en')) || tracks[0];

        if (!enTrack || !enTrack.baseUrl) {
            throw new Error("NO_EN_TRACK");
        }

        console.log(`[Transcript] Manual Scraper found track. Fetching XML...`);
        const xmlRes = await fetch(enTrack.baseUrl);
        const xml = await xmlRes.text();

        if (!xml || xml.trim().length === 0) {
            throw new Error("EMPTY_XML");
        }

        // High-performance XML segment extraction
        const segments = xml.split(/<text[^>]*>/).slice(1);
        const text = segments
            .map(segment => {
                return segment.split('</text>')[0]
                    .replace(/<[^>]*>/g, '')
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>');
            })
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

        return text;
    } catch (e) {
        throw e;
    }
}

/**
 * Fallback method: Multi-client yt-dlp (Robust)
 */
async function fetchYtDlpTranscript(videoId: string): Promise<string> {
    console.log(`[Transcript] Falling back to multi-client yt-dlp for ${videoId}...`);
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Order of clients to try: Android, IOS, web_creator, and TV (often most permissive)
    const clients = ['android', 'ios', 'web_creator', 'tv'];
    let lastErrorMessage = "";

    // Support for an optional proxy to bypass Vercel IP blocks
    const proxy = process.env.YOUTUBE_PROXY;

    for (const client of clients) {
        try {
            console.log(`[Transcript] yt-dlp attempt: ${client}${proxy ? ' (via proxy)' : ''}...`);
            const quotedBinary = `"${binaryPath}"`;
            const flags = [
                '--dump-single-json',
                '--skip-download',
                '--no-warnings',
                '--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"',
                `--extractor-args "youtube:player_client=${client}"`,
                proxy ? `--proxy "${proxy}"` : '',
                '--geo-bypass'
            ].filter(Boolean).join(' ');

            const command = `${quotedBinary} ${flags} "${videoUrl}"`;
            const stdout = execSync(command, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
            const rawJson = JSON.parse(stdout);

            const automaticCaptions = rawJson.automatic_captions || {};
            const captions = rawJson.subtitles || {};
            const enSubs = (captions && captions.en) || (automaticCaptions && automaticCaptions.en) || [];

            if (!enSubs || enSubs.length === 0) continue;

            const track = enSubs.find((t: any) => t.ext === 'vtt' || t.ext === 'srv3' || t.ext === 'ttml') || enSubs[0];
            if (!track || !track.url) continue;

            const res = await fetch(track.url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const textData = await res.text();
            return cleanSubtitleText(textData);

        } catch (error: any) {
            const stderr = error.stderr?.toString() || "";
            lastErrorMessage = stderr || error.message || "Unknown error";
            console.warn(`[Transcript] yt-dlp ${client} failed: ${lastErrorMessage.substring(0, 50)}...`);
            continue;
        }
    }

    throw new Error(lastErrorMessage);
}

/**
 * Main Professional Entry Point
 */
export async function fetchTranscript(videoId: string): Promise<string> {
    try {
        // Stage 1: Fast Scraper
        return await fetchManualTranscript(videoId);
    } catch (e: any) {
        console.warn(`[Transcript] Stage 1 (Manual) failed: ${e.message}`);

        // Stage 2: Robust yt-dlp
        try {
            return await fetchYtDlpTranscript(videoId);
        } catch (e2: any) {
            console.error(`[Transcript] Stage 2 (yt-dlp) failed: ${e2.message}`);

            if (e2.message.includes("Sign in to confirm you’re not a bot")) {
                throw new Error("YouTube has blocked the request due to heavy traffic from Vercel's data center. Try again later or use a different video.");
            }
            throw new Error(`Failed to fetch transcript: ${e2.message}`);
        }
    }
}

/**
 * Helper to clean up VTT/XML/SRTv subtitles into plain text
 */
function cleanSubtitleText(rawData: string): string {
    // If it's XML (timedtext), handle it specifically first
    if (rawData.includes('<transcript>')) {
        const segments = rawData.split(/<text[^>]*>/).slice(1);
        return segments
            .map(segment => {
                return segment.split('</text>')[0]
                    .replace(/<[^>]*>/g, '')
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>');
            })
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Otherwise treat as VTT/SRT
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
