
async function testEmbed(videoId: string) {
    console.log(`Testing Embed for ${videoId}...`);

    try {
        const res = await fetch(`https://www.youtube.com/embed/${videoId}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
        });

        const html = await res.text();
        console.log(`HTML length: ${html.length}`);

        const configMatch = html.match(/yt\.setConfig\({'PLAYER_CONFIG':\s*({.+?})\);/);
        // OR
        const playerResponseMatch = html.match(/"player_response":"({.+?})"/); // embed page often has it simpler

        if (configMatch) {
            console.log("Found config!");
            const config = JSON.parse(configMatch[1]);
            const playerResponse = JSON.parse(config.args.player_response);
            const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            console.log(`Tracks: ${tracks?.length}`);
            if (tracks?.length) {
                console.log(`First URL: ${tracks[0].baseUrl}`);
                const sub = await fetch(tracks[0].baseUrl);
                const text = await sub.text();
                console.log(`Content: ${text.length} chars`);
            }
        }
    } catch (e: any) {
        console.log(`Error: ${e.message}`);
    }
}

testEmbed("-MTRxRO5SRA");
