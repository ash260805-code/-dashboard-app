const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const binaryPath = path.join(process.cwd(), 'bin', binaryName);

console.log(`Checking binary at: ${binaryPath}`);
if (!fs.existsSync(binaryPath)) {
    console.error("Binary NOT FOUND!");
    process.exit(1);
}

console.log("Running --version...");
const result = spawnSync(binaryPath, ['--version'], { encoding: 'utf-8' });

console.log("Status:", result.status);
console.log("Error:", result.error);
console.log("Stdout:", result.stdout);
console.log("Stderr:", result.stderr);
