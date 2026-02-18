async function testApi(url) {
    console.log(`Testing API: ${url}`);
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) {
            console.log(`Failed: ${res.status}`);
            return;
        }
        const data = await res.text();
        console.log(`Success! Length: ${data.length}`);
        console.log(`Sample: ${data.substring(0, 200)}`);
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}

async function run() {
    await testApi('https://youtube-transcript.vercel.app/api/transcript?v=chQNuV9B-Rw');
    await testApi('https://youtubetranscripts.org/api/subtitles?video_id=chQNuV9B-Rw');
}

run();
