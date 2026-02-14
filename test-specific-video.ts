
import { fetchTranscript } from "./src/lib/youtube";

async function test() {
    const videoId = "Vxs5zw0NOvU"; // The video causing the error
    console.log(`Testing video: ${videoId}`);

    try {
        const text = await fetchTranscript(videoId);
        console.log(`VICTORY! Fetched ${text.length} chars`);
    } catch (e: any) {
        console.error(`FAILURE: ${e.message}`);
    }
}

test();
