const { YoutubeTranscript } = require('youtube-transcript');

async function test() {
    const videoId = 'chQNuV9B-Rw';
    console.log(`Fetching transcript for ${videoId} using youtube-transcript...`);

    try {
        const transcript = await YoutubeTranscript.fetchTranscript(videoId);
        console.log("Success!");
        console.log("Segment count:", transcript.length);
        const fullText = transcript.map(t => t.text).join(' ');
        console.log("Transcript length:", fullText.length);
        console.log("Sample:", fullText.substring(0, 100));
    } catch (error) {
        console.error("youtube-transcript failed:", error.message);
    }
}

test();
