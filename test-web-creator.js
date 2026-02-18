const { execSync } = require('child_process');
const path = require('path');

const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const binaryPath = path.join(process.cwd(), 'bin', binaryName);
const quotedPath = `"${binaryPath}"`;

async function test() {
    const videoUrl = 'https://www.youtube.com/watch?v=chQNuV9B-Rw';
    // Trying web_creator client which is often less restricted
    const flags = [
        '--dump-single-json',
        '--no-warnings',
        '--skip-download',
        '--extractor-args "youtube:player_client=web_creator"',
        '--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"'
    ].join(' ');

    const command = `${quotedPath} ${flags} "${videoUrl}"`;
    console.log("Running command:", command);

    try {
        const stdout = execSync(command, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
        const json = JSON.parse(stdout);
        console.log("Success! Title:", json.title);
        const automaticCaptions = json.automatic_captions || {};
        const captions = json.subtitles || {};
        const enSubs = (captions && captions.en) || (automaticCaptions && automaticCaptions.en) || [];
        console.log("Found English subtitles:", enSubs.length > 0 ? "Yes" : "No");
    } catch (error) {
        console.error("Test Failed!");
        console.error("Stderr:", error.stderr?.toString());
    }
}

test();
