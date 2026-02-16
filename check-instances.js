
const pipedInstances = [
    "https://pipedapi.kavin.rocks",
    "https://api.piped.privacy.com.de",
    "https://piped-api.lunar.icu",
    "https://pipedapi.drgns.space",
    "https://api.piped.yt",
    "https://piped-api.garudalinux.org",
    "https://pa.il.ax",
    "https://p.odyssey346.dev",
    "https://api.piped.projectsegfau.lt",
    "https://pipedapi.system41.xyz",
    "https://api.piped.zing.studio",
    "https://piped.video",
    "https://piped.tokhmi.xyz",
    "https://piped.moomoo.me",
    "https://piped.syncpundit.io",
    "https://piped.mha.fi",
    "https://api.piped.ham-radio.op.gg",
    "https://piped-api.smnz.de",
    "https://api.piped.adminforge.de",
    "https://pipedapi.ducks.party",
    "https://pd.circl.es",
    "https://pipedapi.ngn.tf",
];

const invidiousInstances = [
    "https://inv.tux.pizza",
    "https://invidious.flokinet.to",
    "https://invidious.projectsegfau.lt",
    "https://vid.puffyan.us",
    "https://yewtu.be",
    "https://yt.artemislena.eu",
    "https://invidious.privacydev.net",
    "https://iv.ggtyler.dev",
    "https://invidious.lunar.icu",
    "https://inv.nadeko.net",
    "https://invidious.protokolla.fi",
    "https://invidious.drgns.space",
    "https://invidious.jing.rocks",
    "https://invidious.nerdvpn.de",
    "https://invidious.perennialte.ch",
    "https://invidious.einfachzocken.eu",
    "https://invidious.fdn.fr",
    "https://invidious.no-logs.com",
];

async function checkPiped(url, videoId) {
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${url}/streams/${videoId}`, { signal: controller.signal });
        clearTimeout(id);
        if (res.ok) {
            const data = await res.json();
            if (data.subtitles && data.subtitles.length > 0) return true;
        }
    } catch (e) { }
    return false;
}

async function checkInvidious(url, videoId) {
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${url}/api/v1/captions/${videoId}`, { signal: controller.signal });
        clearTimeout(id);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) return true;
        }
    } catch (e) { }
    return false;
}

async function run() {
    const videoId = "PkZNo7MFNFg"; // The problematic video
    console.log(`Checking instances for video: ${videoId}`);

    console.log("\n--- Checking Piped ---");
    const workingPiped = [];
    for (const url of pipedInstances) {
        process.stdout.write(`Testing ${url}... `);
        const works = await checkPiped(url, videoId);
        if (works) {
            console.log("✅");
            workingPiped.push(url);
        } else {
            console.log("❌");
        }
    }

    console.log("\n--- Checking Invidious ---");
    const workingInv = [];
    for (const url of invidiousInstances) {
        process.stdout.write(`Testing ${url}... `);
        const works = await checkInvidious(url, videoId);
        if (works) {
            console.log("✅");
            workingInv.push(url);
        } else {
            console.log("❌");
        }
    }

    console.log("\n--- Summary ---");
    console.log("Working Piped:", JSON.stringify(workingPiped, null, 2));
    console.log("Working Invidious:", JSON.stringify(workingInv, null, 2));
}

run();
