/**
 * Test the ANDROID client for the specific video from user's screenshot
 */
async function testVideo(videoId: string) {
    console.log(`\n=== Testing: ${videoId} ===\n`);

    const clients = [
        {
            name: "ANDROID",
            ua: "com.google.android.youtube/19.09.37 (Linux; U; Android 12; US) gzip",
            body: {
                videoId,
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
            },
        },
        {
            name: "IOS",
            ua: "com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 17_0 like Mac OS X; en_US)",
            body: {
                videoId,
                context: {
                    client: {
                        clientName: "IOS",
                        clientVersion: "19.09.3",
                        deviceModel: "iPhone14,3",
                        hl: "en",
                        gl: "US",
                    },
                },
                contentCheckOk: true,
                racyCheckOk: true,
            },
        },
        {
            name: "WEB",
            ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            body: {
                videoId,
                context: {
                    client: {
                        clientName: "WEB",
                        clientVersion: "2.20240313.05.00",
                        hl: "en",
                        gl: "US",
                    },
                },
            },
        },
    ];

    for (const client of clients) {
        try {
            console.log(`--- ${client.name} ---`);
            const playerRes = await fetch(
                "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "User-Agent": client.ua,
                    },
                    body: JSON.stringify(client.body),
                }
            );
            const data = await playerRes.json();
            console.log(`Playability: ${data?.playabilityStatus?.status}`);
            if (data?.playabilityStatus?.status !== "OK") {
                console.log(`Reason: ${data?.playabilityStatus?.reason || "unknown"}`);
            }

            const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            if (tracks?.length) {
                console.log(`Caption tracks: ${tracks.length}`);
                for (const t of tracks) {
                    console.log(`  - ${t.languageCode} (${t.name?.simpleText || t.kind || "unnamed"})`);
                }
                // Try fetching captions
                const track = tracks[0];
                const captRes = await fetch(track.baseUrl, {
                    headers: { "User-Agent": client.ua },
                });
                const xml = await captRes.text();
                console.log(`Caption content: ${xml.length} chars`);
                if (xml.length > 0) {
                    // Parse
                    const regex = /<(?:text|p|s)[^>]*>([\s\S]*?)<\/(?:text|p|s)>/g;
                    let count = 0;
                    let match;
                    while ((match = regex.exec(xml)) !== null) count++;
                    console.log(`Parsed segments: ${count}`);
                    if (count > 0) {
                        console.log(`✅ SUCCESS with ${client.name}!`);
                    }
                }
            } else {
                console.log(`No caption tracks`);
            }
        } catch (e: any) {
            console.error(`Error: ${e.message}`);
        }
    }
}

testVideo("-MTRxRO5SRA");
