/**
 * Test: Fetch YouTube transcript by scraping the watch page HTML
 * This approach mimics what a browser does and is more likely to work on Vercel.
 */

async function fetchTranscriptViaWatchPage(videoId: string): Promise<string> {
    // Step 1: Fetch the YouTube watch page
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`Fetching watch page: ${watchUrl}`);

    const response = await fetch(watchUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml",
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch YouTube page: ${response.status}`);
    }

    const html = await response.text();
    console.log(`Page HTML length: ${html.length}`);

    // Step 2: Extract ytInitialPlayerResponse from the page
    const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?})\s*;\s*(?:var\s|<\/script)/);
    if (!playerResponseMatch) {
        console.log("Could not find ytInitialPlayerResponse, trying alternative pattern...");
        // Try alternative pattern
        const altMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?})\s*;/);
        if (!altMatch) {
            // Check if there's a consent/cookie wall
            if (html.includes("consent.youtube.com") || html.includes("CONSENT")) {
                throw new Error("YouTube requires cookie consent from this IP/region");
            }
            throw new Error("Could not extract player data from YouTube page");
        }
        return await processPlayerResponse(altMatch[1]);
    }

    return await processPlayerResponse(playerResponseMatch[1]);
}

async function processPlayerResponse(jsonStr: string): Promise<string> {
    let playerData: any;
    try {
        playerData = JSON.parse(jsonStr);
    } catch (e) {
        throw new Error("Failed to parse player response JSON");
    }

    console.log("Playability status:", playerData?.playabilityStatus?.status);

    const captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captionTracks || captionTracks.length === 0) {
        console.log("No caption tracks found in player data");
        throw new Error("No captions available");
    }

    console.log(`Found ${captionTracks.length} caption tracks:`);
    captionTracks.forEach((t: any) => console.log(` - ${t.languageCode}: ${t.name?.simpleText || t.name?.runs?.[0]?.text || 'unnamed'}`));

    // Prefer English
    const englishTrack = captionTracks.find(
        (t: any) => t.languageCode === "en" || t.languageCode?.startsWith("en")
    );
    const selectedTrack = englishTrack || captionTracks[0];
    let captionUrl = selectedTrack.baseUrl;

    // Request XML format
    if (!captionUrl.includes("fmt=")) {
        captionUrl += "&fmt=srv3";
    }

    console.log(`Fetching captions from: ${captionUrl.substring(0, 80)}...`);

    const captionResponse = await fetch(captionUrl);
    if (!captionResponse.ok) {
        throw new Error(`Failed to fetch captions: ${captionResponse.status}`);
    }

    const captionXml = await captionResponse.text();
    console.log(`Caption XML length: ${captionXml.length}`);
    console.log(`Caption XML preview: ${captionXml.substring(0, 200)}`);

    // Parse text from XML
    const textSegments: string[] = [];
    const regex = /<(?:text|p|s)[^>]*>([\s\S]*?)<\/(?:text|p|s)>/g;
    let match;

    while ((match = regex.exec(captionXml)) !== null) {
        let text = match[1]
            .replace(/<[^>]*>/g, "")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, " ")
            .replace(/\n/g, " ")
            .trim();

        if (text) {
            textSegments.push(text);
        }
    }

    console.log(`Extracted ${textSegments.length} text segments`);

    if (textSegments.length === 0) {
        throw new Error("Could not extract text from captions");
    }

    const fullText = textSegments.join(" ");
    console.log(`Full transcript length: ${fullText.length} characters`);
    console.log(`Preview: ${fullText.substring(0, 200)}`);

    return fullText;
}

// Test with the freeCodeCamp video
async function main() {
    const videoId = "PkZNo7MFNFg";
    console.log(`\n=== Testing Watch Page Approach for video: ${videoId} ===\n`);

    try {
        const transcript = await fetchTranscriptViaWatchPage(videoId);
        console.log(`\n✅ SUCCESS! Got ${transcript.length} characters of transcript`);
    } catch (err: any) {
        console.error(`\n❌ FAILED: ${err.message}`);
    }

    // Also test the problematic video
    const videoId2 = "MFnn2zj3byA";
    console.log(`\n=== Testing Watch Page Approach for video: ${videoId2} ===\n`);

    try {
        const transcript = await fetchTranscriptViaWatchPage(videoId2);
        console.log(`\n✅ SUCCESS! Got ${transcript.length} characters of transcript`);
    } catch (err: any) {
        console.error(`\n❌ FAILED: ${err.message}`);
    }
}

main();
