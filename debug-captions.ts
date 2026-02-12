/**
 * Test ANDROID Innertube player with consent cookie
 * This should return caption URLs with proper IP
 */

async function fetchWithAndroid(videoId: string) {
    console.log(`\n=== ANDROID Innertube for: ${videoId} ===\n`);

    // Pre-set consent cookie
    const consentCookie = "CONSENT=YES+yt.453767867.en+FP+XXXXXXXXXX";

    const playerRes = await fetch(
        "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "com.google.android.youtube/19.09.37 (Linux; U; Android 12; US) gzip",
                "Cookie": consentCookie,
            },
            body: JSON.stringify({
                videoId: videoId,
                context: {
                    client: {
                        clientName: "ANDROID",
                        clientVersion: "19.09.37",
                        androidSdkVersion: 31,
                        hl: "en",
                        gl: "US",
                    },
                },
                contentCheckOk: true,
                racyCheckOk: true,
            }),
        }
    );

    console.log(`Player Status: ${playerRes.status}`);
    const playerData = await playerRes.json();
    console.log(`Playability: ${playerData?.playabilityStatus?.status}`);

    if (playerData?.playabilityStatus?.status !== "OK") {
        console.log(`Reason: ${playerData?.playabilityStatus?.reason}`);
    }

    const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks?.length) {
        console.log("No caption tracks");
        return;
    }

    console.log(`Caption tracks: ${tracks.length}`);

    for (const track of tracks) {
        console.log(`\n--- Track: ${track.languageCode} (${track.name?.simpleText || 'unnamed'}) ---`);
        const url = track.baseUrl;
        console.log(`URL: ${url.substring(0, 120)}...`);

        // Check if URL has proper IP
        const ipMatch = url.match(/ip=([^&]+)/);
        console.log(`IP in URL: ${ipMatch ? ipMatch[1] : 'not found'}`);

        // Try fetching
        const captRes = await fetch(url, {
            headers: {
                "User-Agent": "com.google.android.youtube/19.09.37 (Linux; U; Android 12; US) gzip",
                "Cookie": consentCookie,
            },
        });
        const xml = await captRes.text();
        console.log(`Response: ${captRes.status}, Length: ${xml.length}`);
        if (xml.length > 0) {
            console.log(`Preview: ${xml.substring(0, 300)}`);

            // Try parsing
            const regex = /<(?:text|p|s)[^>]*>([\s\S]*?)<\/(?:text|p|s)>/g;
            let count = 0;
            let match;
            while ((match = regex.exec(xml)) !== null) count++;
            console.log(`Parsed segments: ${count}`);
        }
    }
}

async function main() {
    await fetchWithAndroid("dQw4w9WgXcQ");
    await fetchWithAndroid("qzq_-plz0bQ");
}

main();
