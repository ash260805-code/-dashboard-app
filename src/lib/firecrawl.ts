import FirecrawlApp from "@mendable/firecrawl-js";

const apiKey = process.env.FIRECRAWL_API_KEY;

let app: FirecrawlApp | null = null;

if (apiKey) {
    app = new FirecrawlApp({ apiKey: apiKey });
} else {
    console.warn("FIRECRAWL_API_KEY is not defined, Firecrawl features will be disabled.");
}

export async function searchAndScrape(query: string) {
    if (!app) {
        throw new Error("Firecrawl API key is missing");
    }

    try {
        console.log(`Searching Firecrawl for: ${query}`);
        // Remove scrapeOptions for faster/more reliable response on Vercel
        const searchResponse = await app.search(query, {
            limit: 5
        } as any);

        if (!(searchResponse as any).success) {
            throw new Error(`Firecrawl search failed: ${JSON.stringify(searchResponse)}`);
        }

        const results = (searchResponse as any).data || [];

        return results.map((result: any) => ({
            title: result.title || "Untitled",
            url: result.url,
            // Fallback to description/snippet if markdown is missing (no scrapeOptions)
            content: result.markdown || result.description || result.snippet || "",
        }));

    } catch (error) {
        console.error("Firecrawl Error details:", error);
        throw error; // Rethrow to handle in API route
    }
}
