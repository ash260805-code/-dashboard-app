require('dotenv').config();
const FirecrawlApp = require('@mendable/firecrawl-js').default;
const apiKey = process.env.FIRECRAWL_API_KEY;
const app = new FirecrawlApp({ apiKey: apiKey });

async function run() {
    console.log("Searching for: expand CC");
    try {
        const res = await app.search("expand CC", { limit: 2 });
        console.log("Response Keys:", Object.keys(res));
        console.log("First few chars of response:", JSON.stringify(res).slice(0, 500));
    } catch (e) {
        console.log("Caught Error:", e.message);
    }
}
run();
