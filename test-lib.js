const { create } = require('youtube-dl-exec');
const path = require('path');

const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const binaryPath = path.join(process.cwd(), 'bin', binaryName);
const youtubedl = create(binaryPath);

async function test() {
    const videoUrl = 'https://www.youtube.com/watch?v=chQNuV9B-Rw';
    console.log("Testing library with dumpSingleJson...");

    try {
        const output = await youtubedl(videoUrl, {
            dumpSingleJson: true,
            noWarnings: true,
            skipDownload: true,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });
        console.log("Output types:", typeof output);
        console.log("Output keys:", Object.keys(output).slice(0, 10));
    } catch (error) {
        console.error("Library Failed!");
        console.error("Name:", error.name);
        console.error("Message:", error.message);
        console.error("Command:", error.command);
        console.error("Stderr:", error.stderr);
    }
}

test();
