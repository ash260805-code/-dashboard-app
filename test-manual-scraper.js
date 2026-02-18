async function fetchManual(videoId) {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`[Manual] Fetching: ${url}`);

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.youtube.com/'
    };

    const res = await fetch(url, { headers });
    const html = await res.text();

    const match = html.match(/"captionTracks":\s*(\[.*?\])/);
    if (!match) {
        throw new Error("No captionTracks found in HTML");
    }

    const tracks = JSON.parse(match[1]);
    const enTrack = tracks.find(t => t.languageCode === 'en' || t.vssId?.includes('.en')) || tracks[0];

    console.log(`[Manual] Fetching XML: ${enTrack.baseUrl}`);
    const xmlRes = await fetch(enTrack.baseUrl, { headers });
    const xml = await xmlRes.text();

    console.log("Raw XML Preview:", xml.substring(0, 500));

    if (xml.trim().length === 0) {
        console.log("XML IS EMPTY!");
    }

    // Improved XML text extraction
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

    return text;
}

async function test() {
    try {
        const text = await fetchManual('chQNuV9B-Rw');
        console.log("Success! Length:", text.length);
        console.log("Sample:", text.substring(0, 200));
    } catch (e) {
        console.error("Failed:", e.message);
    }
}

test();
