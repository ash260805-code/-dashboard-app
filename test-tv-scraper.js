async function fetchTv(videoId) {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`[TV-Spoof] Fetching HTML: ${url}`);

    // Use a TV-like User-Agent
    const tvUserAgent = 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 5.0) AppleWebkit/537.36 (KHTML, like Gecko) SamsungBrowser/2.2 Chrome/63.0.3239.150 TV Safari/537.36';

    const headers = {
        'User-Agent': tvUserAgent,
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.youtube.com/'
    };

    const res = await fetch(url, { headers });
    const html = await res.text();

    const match = html.match(/"captionTracks":\s*(\[.*?\])/);
    if (!match) throw new Error("NO_CAPTION_TRACKS_IN_HTML");

    const tracks = JSON.parse(match[1]);
    const enTrack = tracks.find(t => t.languageCode === 'en' || t.vssId?.includes('.en'));
    if (!enTrack) throw new Error("NO_EN_TRACK_FOUND");

    console.log(`[TV-Spoof] Fetching XML: ${enTrack.baseUrl}`);

    // The TRICK: Fetch the XML using the SAME TV headers
    const xmlRes = await fetch(enTrack.baseUrl, { headers });
    const xml = await xmlRes.text();

    return xml;
}

async function test() {
    try {
        const xml = await fetchTv('chQNuV9B-Rw');
        console.log("Success! XML Length:", xml.length);
        console.log("Preview:", xml.substring(0, 100));
    } catch (e) {
        console.error("Failed:", e.message);
    }
}

test();
