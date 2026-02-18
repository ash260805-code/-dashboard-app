import { fetchTranscript } from './src/lib/youtube';

async function test() {
    const videoId = 'chQNuV9B-Rw'; // The one from the user's error
    console.log(`Testing fetchTranscript for ${videoId}...`);
    try {
        const transcript = await fetchTranscript(videoId);
        console.log("Success! Transcript length:", transcript.length);
        console.log("Sample:", transcript.substring(0, 100));
    } catch (error) {
        console.error("Test failed:", error.message);
    }
}

test();
