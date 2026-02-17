const { create } = require('youtube-dl-exec');
const path = require('path');

// Use 8.3 short path to avoid spaces in "Avinash P"
const wrapperPath = 'C:\\Users\\AVINAS~1\\.gemini\\antigravity\\scratch\\dashboard-app\\yt-dlp-wrapper.bat';
const youtubedl = create(wrapperPath);

async function test() {
    console.log(`Testing yt-dlp via wrapper at ${wrapperPath}...`);
    try {
        const output = await youtubedl('https://www.youtube.com/watch?v=jNQXAC9IVRw', {
            dumpSingleJson: true,
            noWarnings: true,
            skipDownload: true
        });
        console.log("Success! Title:", output.title);
    } catch (e) {
        console.error("Test failed full error:", e);
        if (e.stdout) console.error("STDOUT:", e.stdout);
        if (e.stderr) console.error("STDERR:", e.stderr);
    }
}

test();
