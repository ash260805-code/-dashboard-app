const { create } = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');

async function test() {
    console.log("Testing standalone yt-dlp...");

    const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    const binaryPath = path.join(process.cwd(), 'bin', binaryName);

    if (!fs.existsSync(binaryPath)) {
        console.error(`Binary not found at ${binaryPath}`);
        return;
    }

    console.log(`Using binary at: ${binaryPath}`);
    const youtubedl = create(binaryPath);
    const videoUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // Me at the zoo

    try {
        console.log("Fetching metadata...");
        const rawJson = await youtubedl(videoUrl, {
            dumpSingleJson: true,
            skipDownload: true,
            noWarnings: true,
        });

        console.log("Metadata fetched. Title:", rawJson.title);

        const automaticCaptions = rawJson.automatic_captions || {};
        const captions = rawJson.subtitles || {};
        const enSubs = captions.en || automaticCaptions.en || [];

        if (enSubs.length > 0) {
            console.log("Found captions:", enSubs.length);
            const track = enSubs.find(t => t.ext === 'vtt' || t.ext === 'srv3') || enSubs[0];
            console.log("Fetching caption URL:", track.url);

            const res = await fetch(track.url);
            const text = await res.text();
            console.log("Caption preview:", text.substring(0, 100));
        } else {
            console.log("No captions found.");
        }

    } catch (e) {
        console.error("Test failed:", e);
    }
}

test();
