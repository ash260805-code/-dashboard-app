const { execSync } = require('child_process');
const path = require('path');

const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const binaryPath = path.join(process.cwd(), 'bin', binaryName);
const quotedPath = `"${binaryPath}"`;

async function test() {
    const videoUrl = 'https://www.youtube.com/watch?v=chQNuV9B-Rw';
    const command = `${quotedPath} --dump-single-json --no-warnings --skip-download "${videoUrl}"`;

    console.log("Running command:", command);

    try {
        const stdout = execSync(command, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
        const json = JSON.parse(stdout);
        console.log("Success! Title:", json.title);
    } catch (error) {
        console.error("ExecSync Failed!");
        console.error("Status:", error.status);
        console.error("Stderr:", error.stderr);
    }
}

test();
