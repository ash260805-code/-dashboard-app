const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function downloadYtDlp() {
    const platform = process.platform;
    let fileName = 'yt-dlp';
    let url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

    if (platform === 'win32') {
        fileName = 'yt-dlp.exe';
        url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
    } else if (platform === 'linux') {
        url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
    } else if (platform === 'darwin') {
        url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos';
    } else {
        console.error(`Unsupported platform: ${platform}`);
        process.exit(1);
    }

    const binDir = path.join(process.cwd(), 'bin');
    if (!fs.existsSync(binDir)) {
        fs.mkdirSync(binDir);
    }

    const filePath = path.join(binDir, fileName);

    console.log(`Downloading ${fileName} from ${url} to ${filePath}...`);

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);

        const buffer = await res.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(buffer));

        if (platform !== 'win32') {
            fs.chmodSync(filePath, '755'); // Make executable
        }

        console.log('Download complete.');
    } catch (error) {
        console.error('Download failed:', error);
        process.exit(1);
    }
}

downloadYtDlp();
