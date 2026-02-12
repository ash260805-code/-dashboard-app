
const instances = [
    "https://inv.tux.pizza",
    "https://invidious.flokinet.to",
    "https://yt.artemislena.eu",
    "https://invidious.projectsegfau.lt",
];

async function testInvidious(videoId: string) {
    console.log(`Testing Invidious for ${videoId}...`);

    for (const instance of instances) {
        try {
            console.log(`\nTrying ${instance}...`);
            const res = await fetch(`${instance}/api/v1/captions/${videoId}`);
            if (!res.ok) {
                console.log(`Failed: ${res.status}`);
                continue;
            }

            const tracks = await res.json();
            console.log(`Found ${tracks.length} tracks`);

            const enTrack = tracks.find((t: any) => t.languageCode === 'en' || t.languageCode?.startsWith('en'));
            if (!enTrack) {
                console.log("No English track found");
                continue;
            }

            console.log(`Fetching track: ${enTrack.label} (${enTrack.languageCode})`);
            const url = `${instance}${enTrack.url}`;
            const subRes = await fetch(url);
            const text = await subRes.text();

            console.log(`Content length: ${text.length}`);
            console.log(`Snippet: ${text.substring(0, 100)}`);

            if (text.length > 50) {
                console.log("✅ SUCCESS!");
                return;
            }
        } catch (e: any) {
            console.log(`Error: ${e.message}`);
        }
    }
}

testInvidious("-MTRxRO5SRA");
