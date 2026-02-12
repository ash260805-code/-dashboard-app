// Test different Innertube client contexts
async function testClients() {
    const videoId = "MFnn2zj3byA";

    const clients = [
        {
            name: "ANDROID",
            context: {
                client: {
                    clientName: "ANDROID",
                    clientVersion: "19.09.37",
                    androidSdkVersion: 30,
                    hl: "en",
                    gl: "US",
                },
            },
        },
        {
            name: "WEB_EMBEDDED_PLAYER",
            context: {
                client: {
                    clientName: "WEB_EMBEDDED_PLAYER",
                    clientVersion: "1.20240101.00.00",
                    hl: "en",
                    gl: "US",
                },
            },
        },
        {
            name: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
            context: {
                client: {
                    clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
                    clientVersion: "2.0",
                    hl: "en",
                    gl: "US",
                },
            },
        },
        {
            name: "IOS",
            context: {
                client: {
                    clientName: "IOS",
                    clientVersion: "19.09.3",
                    deviceModel: "iPhone14,3",
                    hl: "en",
                    gl: "US",
                },
            },
        },
    ];

    for (const client of clients) {
        console.log(`\n--- Testing: ${client.name} ---`);
        try {
            const resp = await fetch("https://www.youtube.com/youtubei/v1/player", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0",
                },
                body: JSON.stringify({
                    videoId,
                    context: client.context,
                }),
            });

            const data = await resp.json();
            const status = data?.playabilityStatus?.status;
            const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

            console.log("Playability:", status);

            if (tracks && tracks.length > 0) {
                console.log("✅ Caption tracks:", tracks.length);
                console.log("Languages:", tracks.map((t: any) => t.languageCode).join(", "));

                // Try fetching actual captions
                const baseUrl = tracks[0].baseUrl;
                const formats = ["srv1", "srv2", "srv3", "vtt"];

                for (const fmt of formats) {
                    const captionUrl = baseUrl + (baseUrl.includes("?") ? "&" : "?") + "fmt=" + fmt;
                    console.log(`\nTesting format: ${fmt}`);
                    console.log(`URL: ${captionUrl.substring(0, 100)}...`);

                    try {
                        const captionResp = await fetch(captionUrl);
                        const text = await captionResp.text();
                        console.log(`Response length: ${text.length}`);
                        console.log(`Start of response: ${text.substring(0, 150)}`);

                        const segments = text.match(/<text[^>]*>([\s\S]*?)<\/text>/g) ||
                            text.match(/<p[^>]*>([\s\S]*?)<\/p>/g) ||
                            text.match(/WEBVTT/);

                        console.log(`Segments/Matches found: ${segments ? segments.length : 0}`);
                    } catch (e) {
                        console.log(`Error fetching ${fmt}:`, e);
                    }
                }
                console.log("✅✅ PROCESSED Android tracks");
            } else {
                console.log("❌ No captions");
                if (data?.playabilityStatus?.reason) {
                    console.log("Reason:", data.playabilityStatus.reason);
                }
            }
        } catch (err) {
            console.log("❌ Error:", err);
        }
    }
}

testClients();
