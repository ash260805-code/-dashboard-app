async function fetchPbj(videoId) {
    const url = `https://www.youtube.com/watch?v=${videoId}&pbj=1`;
    const headers = {
        'X-YouTube-Client-Name': '1',
        'X-YouTube-Client-Version': '2.20240214.04.00',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Referer': `https://www.youtube.com/watch?v=${videoId}`,
    };

    const res = await fetch(url, { headers });
    const json = await res.json();

    const playerResponse = json.playerResponse || (Array.isArray(json) ? json.find(i => i.playerResponse)?.playerResponse : null);

    if (!playerResponse) {
        throw new Error("PLAYER_RESPONSE_NOT_FOUND");
    }

    const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captions || captions.length === 0) {
        throw new Error("NO_CAPTIONS_ARRAY");
    }

    const enTrack = captions.find(t => t.languageCode === 'en' || t.vssId?.includes('.en'));
    if (!enTrack) throw new Error("NO_EN_TRACK_FOUND");

    console.log(`[PBJ] Fetching XML: ${enTrack.baseUrl}`);
    const xmlRes = await fetch(enTrack.baseUrl, { headers });
    const xml = await xmlRes.text();

    return xml;
}

async function test() {
    try {
        const xml = await fetchPbj('chQNuV9B-Rw');
        console.log("Success! XML Length:", xml.length);
        console.log("Preview:", xml.substring(0, 100));
    } catch (e) {
        console.error("Failed:", e.message);
    }
}

test();
