require('dotenv').config();
const FirecrawlApp = require('@mendable/firecrawl-js').default;

const apiKey = process.env.FIRECRAWL_API_KEY;
console.log("Using API Key:", apiKey ? "PRESENT" : "MISSING");

const app = new FirecrawlApp({ apiKey: apiKey });

async function testQuery(q) {
    try {
        console.log(`\n--- Testing Query: "${q}" ---`);
        const response = await app.search(q, { limit: 2 });
        console.log("Success:", response.success);
        if (response.success) {
            console.log("Data count:", response.data?.length);
            if (response.data && response.data.length > 0) {
                console.log("First result URL:", response.data[0].url);
                console.log("First result snippet:", response.data[0].description || response.data[0].snippet || "NO SNIPPET");
            }
        } else {
            console.log("Error details:", JSON.stringify(response, null, 2));
        }
    } catch (err) {
        console.error("CRITICAL ERROR:", err.message);
        if (err.response) {
            console.error("Response Data:", JSON.stringify(err.response.data, null, 2));
        }
    }
}

async function run() {
    await testQuery("full form of DBMS"); // Known working
    await testQuery("expand CC"); // Reported failing
}

run();
