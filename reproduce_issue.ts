import { fetchTranscript } from "./src/lib/youtube";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    const videoId = "PkZNo7MFNFg"; // The video ID user mentioned
    console.log(`Testing transcript fetch for video: ${videoId}`);

    try {
        const transcript = await fetchTranscript(videoId);
        console.log("SUCCESS!");
        console.log(`Transcript length: ${transcript.length}`);
        console.log("First 100 chars:", transcript.substring(0, 100));
    } catch (error: any) {
        console.error("FAILED!");
        console.error(error.message);
        if (error.stack) {
            console.error(error.stack);
        }
    }
}

main();
