const { Innertube } = require('youtubei.js');

async function test() {
    console.log("Initializing Innertube with TV client...");
    try {
        // Try to initialize with a different client type if possible
        // Note: youtubei.js usually handles this internally, but we can try to force session params
        const youtube = await Innertube.create();

        const videoId = 'chQNuV9B-Rw';
        console.log(`Fetching info for ${videoId}...`);

        // Get info with a specific client if youtube-dl-exec failed
        const info = await youtube.getInfo(videoId);
        console.log("Video Title:", info.basic_info.title);

        const transcript_data = await info.getTranscript();

        if (transcript_data && transcript_data.segments) {
            console.log("Success with default client!");
            return;
        }

        console.log("Fallback: No transcript in main info, trying direct call...");
        // Some videos need a different approach
    } catch (error) {
        console.error("Default Failed:", error.message);

        console.log("Trying FALLBACK logic (mimicking common transcript scrapers)...");
        // Manual fetch of the transcript XML using the video ID
        try {
            const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
            const html = await res.text();
            if (html.includes('captionTracks')) {
                console.log("Success! Found captionTracks in HTML.");
            } else {
                console.log("HTML does not contain captionTracks.");
            }
        } catch (fetchErr) {
            console.error("Manual fetch failed:", fetchErr.message);
        }
    }
}

test();
