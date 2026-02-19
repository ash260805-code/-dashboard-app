/**
 * Cloudflare Worker: YouTube Transcript Proxy
 * Deploy this to Cloudflare Workers (free tier: 100k requests/day).
 * Then set TRANSCRIPT_PROXY_URL in Vercel env to your worker's URL.
 * 
 * Usage: GET https://your-worker.workers.dev/?v=VIDEO_ID
 */

export default {
    async fetch(request) {
        const url = new URL(request.url);
        const videoId = url.searchParams.get('v');

        if (!videoId) {
            return new Response(JSON.stringify({ error: 'Missing video ID (?v=...)' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        try {
            // Step 1: Fetch the YouTube page to get caption track URLs
            const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                }
            });
            const html = await pageRes.text();

            // Check for bot detection
            if (html.includes('Sign in to confirm')) {
                return new Response(JSON.stringify({ error: 'BOT_DETECTION' }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            }

            // Extract caption tracks
            const match = html.match(/"captionTracks":\s*(\[.*?\])/);
            if (!match) {
                return new Response(JSON.stringify({ error: 'NO_CAPTIONS_FOUND' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            }

            const tracks = JSON.parse(match[1]);
            const enTrack = tracks.find(t => t.languageCode === 'en' || t.vssId?.includes('.en')) || tracks[0];

            if (!enTrack?.baseUrl) {
                return new Response(JSON.stringify({ error: 'NO_ENGLISH_TRACK' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            }

            // Step 2: Fetch the actual transcript XML
            const xmlRes = await fetch(enTrack.baseUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Referer': `https://www.youtube.com/watch?v=${videoId}`
                }
            });
            const xml = await xmlRes.text();

            // Step 3: Parse XML into plain text
            const text = xml
                .split(/<text[^>]*>/)
                .slice(1)
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

            return new Response(JSON.stringify({ success: true, transcript: text }), {
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });

        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }
    }
};
