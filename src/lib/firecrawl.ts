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
        const searchResponse = await app.search(query, {
            scrapeOptions: {
                formats: ["markdown"]
            },
            limit: 3
        } as any);

        if (!(searchResponse as any).success) {
            throw new Error(`Firecrawl search failed: ${JSON.stringify(searchResponse)}`);
        }

        return (searchResponse as any).data.map((result: any) => ({
            title: result.title || "Untitled",
            url: result.url,
            content: result.markdown || result.description || "",
        }));

    } catch (error) {
        console.error("Firecrawl Error:", error);
        return [];
    }
}
