async function fetchMobile(videoId) {
    const url = `https://m.youtube.com/watch?v=${videoId}`;
    console.log(`[Mobile] Fetching: ${url}`);

    const headers = {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/'
    };

    const res = await fetch(url, { headers });
    const html = await res.text();

    // Professional JSON extraction using bracket matching
    const startStr = 'ytInitialPlayerResponse = ';
    const startIndex = html.indexOf(startStr);
    if (startIndex === -1) throw new Error("ytInitialPlayerResponse not found");

    let jsonStr = "";
    let depth = 0;
    for (let i = startIndex + startStr.length; i < html.length; i++) {
        const char = html[i];
        if (char === '{') depth++;
        if (char === '}') depth--;
        jsonStr += char;
        if (depth === 0) break;
    }

    try {
        const playerResponse = JSON.parse(jsonStr);
        const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

        if (!captions || captions.length === 0) {
            throw new Error("No captions found in Mobile JSON");
        }

        const enTrack = captions.find(t => t.languageCode === 'en' || t.vssId?.includes('.en')) || captions[0];
        console.log(`[Mobile] Fetching XML: ${enTrack.baseUrl}`);

        const xmlRes = await fetch(enTrack.baseUrl, { headers });
        const xml = await xmlRes.text();

        return xml;
    } catch (e) {
        console.error("JSON Parsing Error:", e.message);
        throw e;
    }
}

async function test() {
    try {
        const xml = await fetchMobile('chQNuV9B-Rw');
        console.log("Success! XML Length:", xml.length);
        console.log("Sample:", xml.substring(0, 200));
    } catch (e) {
        console.error("Failed:", e.message);
    }
}

test();
