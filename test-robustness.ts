
import { fetchTranscript, extractVideoId } from "./src/lib/youtube";

async function test() {
    const videos = [
        { url: "https://www.youtube.com/watch?v=MFnn2zj3byA", desc: "Short video (AI)" },
        { url: "https://www.youtube.com/watch?v=jNQXAC9IVRw", desc: "Very long video (zoo)" },
        { url: "https://youtu.be/kC5LoGga220", desc: "Shortened URL" },
    ];

    console.log("--- Testing Transcript Robustness ---");

    for (const v of videos) {
        console.log(`\nTesting: ${v.desc} (${v.url})`);
        const id = extractVideoId(v.url);
        if (!id) {
            console.error("❌ Failed to extract ID");
            continue;
        }

        try {
            const start = Date.now();
            const text = await fetchTranscript(id);
            const time = Date.now() - start;

            console.log(`✅ Success in ${time}ms`);
            console.log(`Length: ${text.length} chars`);
            console.log(`Snippet: ${text.substring(0, 50)}...`);
        } catch (e: any) {
            console.error(`❌ Failed: ${e.message}`);
        }
    }
}

test();
