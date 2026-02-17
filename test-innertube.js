const { Innertube, UniversalCache } = require('youtubei.js');

async function test() {
    console.log("Testing Innertube with latest version...");
    try {
        const youtube = await Innertube.create({
            cache: new UniversalCache(false),
            generate_session_locally: true,
            client_type: 'IOS' // Try IOS client
        });
        console.log("Innertube initialized.");
        const info = await youtube.getInfo('jNQXAC9IVRw');
        const transcriptData = await info.getTranscript();

        if (transcriptData?.transcript?.content?.body?.initial_segments) {
            console.log("Transcript found!");
            console.log(transcriptData.transcript.content.body.initial_segments[0].snippet.text);
        } else {
            console.log("No transcript found.");
        }

    } catch (e) {
        console.error("Test failed:", e);
    }
}

test();
