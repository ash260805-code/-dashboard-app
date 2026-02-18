const { Innertube, UniversalCache } = require('youtubei.js');

async function test() {
    console.log("Testing Innertube for video chQNuV9B-Rw...");
    try {
        const youtube = await Innertube.create({
            cache: new UniversalCache(false),
            generate_session_locally: true,
            device_type: 'ANDROID', // Emulate Android app
        });

        const videoId = 'chQNuV9B-Rw';
        console.log("Fetching info...");
        const info = await youtube.getInfo(videoId);
        console.log("Title:", info.basic_info.title);

        console.log("Fetching transcript...");
        const transcriptData = await info.getTranscript();

        if (transcriptData && transcriptData.transcript) {
            console.log("Transcript found!");
            console.log("Lines:", transcriptData.transcript.content.body.initial_segments.length);
            console.log("First line:", transcriptData.transcript.content.body.initial_segments[0].snippet.text);
        } else {
            console.log("No transcript data found.");
        }

    } catch (error) {
        console.error("Innertube failed:", error);
    }
}

test();
