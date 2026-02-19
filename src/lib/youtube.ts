import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// Determine binary path based on platform
const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const binaryPath = path.join(process.cwd(), 'bin', binaryName);

if (process.platform !== 'win32' && fs.existsSync(binaryPath)) {
    try { fs.chmodSync(binaryPath, '755'); } catch (e) { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 0: Cloudflare Worker Proxy (Cookie-Free, Highest Reliability)
// Set TRANSCRIPT_PROXY_URL in Vercel env to your deployed Worker URL.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchViaProxy(videoId: string): Promise<string> {
    const proxyUrl = process.env.TRANSCRIPT_PROXY_URL;
    if (!proxyUrl) throw new Error("PROXY_NOT_CONFIGURED");

    console.log(`[Transcript] Stage 0: Proxy fetch for ${videoId}...`);
    const res = await fetch(`${proxyUrl}?v=${videoId}`, {
        signal: AbortSignal.timeout(15000) // 15s timeout
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Proxy returned ${res.status}`);
    }

    const data = await res.json();
    if (!data.success || !data.transcript) {
        throw new Error(data.error || "PROXY_EMPTY_RESPONSE");
    }

    console.log(`[Transcript] Stage 0 Success! Length: ${data.transcript.length}`);
    return data.transcript;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1: Desktop HTML Scraper (works locally, may fail on Vercel)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchDesktopTranscript(videoId: string): Promise<string> {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`[Transcript] Stage 1: Desktop scrape for ${videoId}...`);

    const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    };

    const res = await fetch(url, { headers, cache: 'no-store' });
    const html = await res.text();

    if (html.includes('Sign in to confirm')) throw new Error("BOT_DETECTION");

    const match = html.match(/"captionTracks":\s*(\[.*?\])/);
    if (!match) throw new Error("NO_CAPTIONS_FOUND");

    const tracks = JSON.parse(match[1]);
    const enTrack = tracks.find((t: any) => t.languageCode === 'en' || t.vssId?.includes('.en')) || tracks[0];
    if (!enTrack?.baseUrl) throw new Error("NO_EN_TRACK");

    console.log(`[Transcript] Found caption track. Fetching XML...`);
    const xmlRes = await fetch(enTrack.baseUrl, { headers });
    const xml = await xmlRes.text();
    if (!xml || xml.trim().length === 0) throw new Error("EMPTY_XML_RESPONSE");

    return cleanSubtitleText(xml);
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2: Multi-client yt-dlp (Robust fallback, requires yt-dlp binary)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchYtDlpTranscript(videoId: string): Promise<string> {
    console.log(`[Transcript] Stage 2: yt-dlp fallback for ${videoId}...`);
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const clients = ['android', 'ios', 'tv', 'web_creator'];
    let lastError = "";
    const proxy = process.env.YOUTUBE_PROXY;

    for (const client of clients) {
        try {
            console.log(`[Transcript] yt-dlp client: ${client}...`);
            const flags = [
                '--dump-single-json', '--skip-download', '--no-warnings',
                '--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"',
                `--extractor-args "youtube:player_client=${client}"`,
                proxy ? `--proxy "${proxy}"` : '',
                '--geo-bypass'
            ].filter(Boolean).join(' ');

            const stdout = execSync(`"${binaryPath}" ${flags} "${videoUrl}"`, {
                encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024
            });
            const json = JSON.parse(stdout);
            const subs = json.subtitles?.en || json.automatic_captions?.en || [];
            if (!subs.length) continue;

            const track = subs.find((t: any) => ['vtt', 'srv3', 'ttml'].includes(t.ext)) || subs[0];
            if (!track?.url) continue;

            const textData = await (await fetch(track.url)).text();
            return cleanSubtitleText(textData);
        } catch (error: any) {
            lastError = error.message || "Unknown";
            continue;
        }
    }
    throw new Error(lastError);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point — 3-Stage Cascade
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchTranscript(videoId: string): Promise<string> {
    // Stage 0: Cloudflare Worker Proxy (best for Vercel, cookie-free)
    try {
        return await fetchViaProxy(videoId);
    } catch (e: any) {
        console.warn(`[Transcript] Stage 0 (Proxy): ${e.message}`);
    }

    // Stage 1: Desktop HTML Scraper
    try {
        return await fetchDesktopTranscript(videoId);
    } catch (e: any) {
        console.warn(`[Transcript] Stage 1 (Desktop): ${e.message}`);
    }

    // Stage 2: yt-dlp multi-client
    try {
        return await fetchYtDlpTranscript(videoId);
    } catch (e: any) {
        console.error(`[Transcript] Stage 2 (yt-dlp): ${e.message}`);
    }

    throw new Error(
        "All transcript methods failed. Deploy the Cloudflare Worker proxy (see /worker folder) " +
        "and set TRANSCRIPT_PROXY_URL in Vercel for cookie-free reliability."
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subtitle Cleaner
// ─────────────────────────────────────────────────────────────────────────────
function cleanSubtitleText(rawData: string): string {
    if (rawData.includes('<transcript>') || rawData.includes('<text')) {
        return rawData
            .split(/<text[^>]*>/).slice(1)
            .map(s => s.split('</text>')[0]
                .replace(/<[^>]*>/g, '')
                .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'))
            .join(' ').replace(/\s+/g, ' ').trim();
    }

    return rawData
        .replace(/<[^>]*>/g, ' ')
        .replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}.*/g, ' ')
        .replace(/WEBVTT|Kind: captions|Language: .*/g, '')
        .replace(/align:start position:.*?%/g, '')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ').trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Video ID Extractor
// ─────────────────────────────────────────────────────────────────────────────
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
