async function test() {
    const videoId = 'chQNuV9B-Rw';
    const url = `https://www.youtube.com/embed/${videoId}`;
    console.log(`Fetching Embed: ${url}`);

    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Referer': 'https://www.google.com/'
            }
        });
        const html = await res.text();

        if (html.includes('captionTracks')) {
            console.log("Success! Found captions in Embed page.");
        } else {
            console.log("Embed page did not contain captions.");
            if (html.includes('Sign in to confirm')) {
                console.log("BLOCKED on Embed page too.");
            }
        }
    } catch (e) {
        console.error("Embed test failed:", e.message);
    }
}

test();
