import { Innertube } from 'youtubei.js';

async function test() {
    console.log("Initializing Innertube with TV_EMBEDDED...");
    try {
        const youtube = await Innertube.create({
            client_type: 'TV_EMBEDDED'
        });

        const videoId = 'chQNuV9B-Rw';
        console.log(`Fetching info for ${videoId}...`);
        const info = await youtube.getInfo(videoId);

        const transcript = await info.getTranscript();
        if (transcript) {
            console.log("Success! Transcript segments found:", transcript.transcript.content.body.initial_segments.length);
            const text = transcript.transcript.content.body.initial_segments.map(s => s.snippet.text).join(' ');
            console.log("Sample:", text.substring(0, 200));
        } else {
            console.log("No transcript found.");
        }
    } catch (e) {
        console.error("Failed:", e.message);
    }
}

test();
