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
 * Professional Stage 1: Mobile Stealth Scraper (Highest bypass rate on Vercel)
 */
async function fetchMobileTranscript(videoId: string): Promise<string> {
    const url = `https://m.youtube.com/watch?v=${videoId}`;
    console.log(`[Transcript] Professional Mobile Fetch for ${videoId}...`);

    const cookies = process.env.YOUTUBE_COOKIES || '';
    const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    };
    if (cookies) headers['Cookie'] = cookies;

    const res = await fetch(url, { headers, cache: 'no-store' });
    const html = await res.text();

    // Professional JSON extraction using robust bracket matching
    const startAssignmentStr = 'ytInitialPlayerResponse = ';
    const startKeyStr = '"playerResponse":';
    let startIndex = html.indexOf(startAssignmentStr);
    let offset = 0;

    if (startIndex !== -1) {
        offset = startAssignmentStr.length;
    } else {
        // Fallback search if the direct assignment isn't found
        startIndex = html.indexOf(startKeyStr);
        if (startIndex !== -1) {
            // We need to find the opening brace after the key and colon
            const colonIndex = html.indexOf(':', startIndex + startKeyStr.length - 1);
            if (colonIndex !== -1) {
                startIndex = colonIndex + 1; // Start after the colon
                // Find the first non-whitespace character after the colon
                while (startIndex < html.length && /\s/.test(html[startIndex])) {
                    startIndex++;
                }
                // If it's not an opening brace, something is wrong, but we'll proceed
                // The loop below will handle finding the first '{'
            } else {
                startIndex = -1; // Colon not found after key, treat as not found
            }
        }
    }

    if (startIndex === -1) {
        if (html.includes('Sign in to confirm')) throw new Error("BOT_DETECTION");
        throw new Error("METADATA_NOT_FOUND");
    }

    let jsonStr = "";
    let depth = 0;
    let found = false;
    // Walk through the HTML to find the balanced JSON object
    for (let i = startIndex + offset; i < html.length; i++) {
        const char = html[i];
        if (char === '{') { depth++; found = true; }
        if (char === '}') depth--;
        if (found) jsonStr += char;
        if (found && depth === 0) break;
    }

    if (!jsonStr) throw new Error("JSON_EXTRACTION_FAILED");

    const playerResponse = JSON.parse(jsonStr);
    const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captions || captions.length === 0) {
        throw new Error("NO_CAPTIONS_ARRAY");
    }

    const enTrack = captions.find((t: any) => t.languageCode === 'en' || t.vssId?.includes('.en')) || captions[0];
    console.log(`[Transcript] Authorized XML found. Fetching...`);

    const xmlRes = await fetch(enTrack.baseUrl, { headers });
    const xml = await xmlRes.text();

    if (!xml || xml.trim().length === 0) {
        throw new Error("EMPTY_XML_RESPONSE");
    }

    return cleanSubtitleText(xml);
}

/**
 * Stage 2: Fallback to multi-client yt-dlp (Robust)
 */
async function fetchYtDlpTranscript(videoId: string): Promise<string> {
    console.log(`[Transcript] Falling back to robust yt-dlp for ${videoId}...`);
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Order of clients to try: Android, IOS, TV, and web_creator (often most permissive)
    const clients = ['android', 'ios', 'tv', 'web_creator'];
    let lastErrorMessage = "";

    // Support for an optional proxy to bypass Vercel IP blocks
    const proxy = process.env.YOUTUBE_PROXY;
    const cookies = process.env.YOUTUBE_COOKIES;

    for (const client of clients) {
        try {
            console.log(`[Transcript] yt-dlp effort: ${client}${proxy ? ' (via proxy)' : ''}...`);
            const quotedBinary = `"${binaryPath}"`;
            const flags = [
                '--dump-single-json',
                '--skip-download',
                '--no-warnings',
                '--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"',
                `--extractor-args "youtube:player_client=${client}"`,
                proxy ? `--proxy "${proxy}"` : '',
                cookies ? `--add-header "Cookie: ${cookies}"` : '',
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
            const textData = await res.text();
            return cleanSubtitleText(textData);

        } catch (error: any) {
            lastErrorMessage = error.message || "Unknown error";
            console.warn(`[Transcript] yt-dlp ${client} failed: ${lastErrorMessage.substring(0, 50)}...`);
            continue;
        }
    }

    throw new Error(lastErrorMessage);
}

/**
 * Main Industrial-Grade Entry Point
 */
export async function fetchTranscript(videoId: string): Promise<string> {
    try {
        // Professional Stage 1
        return await fetchMobileTranscript(videoId);
    } catch (e: any) {
        console.warn(`[Transcript] Professional Stage 1 failed: ${e.message}`);

        // Professional Stage 2
        try {
            return await fetchYtDlpTranscript(videoId);
        } catch (e2: any) {
            console.error(`[Transcript] Professional Stage 2 failed: ${e2.message}`);

            if (e2.message.includes("Sign in to confirm") || e2.message.includes("BOT_DETECTION")) {
                throw new Error("YouTube has blocked the request from Vercel. For 100% reliability, please add your YOUTUBE_COOKIES to Vercel environment variables.");
            }
            throw new Error(`Professional fetch failed: ${e2.message}`);
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
