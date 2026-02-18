import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateAnswer } from "@/lib/ai";
import { searchAndScrape } from "@/lib/firecrawl";

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { query } = await req.json();

        if (!query) {
            return NextResponse.json({ error: "Query is required" }, { status: 400 });
        }

        console.log(`Global Deep Search for: ${query}`);

        // 1. Perform Web Search (Firecrawl)
        const webResults = await searchAndScrape(query);

        console.log(`[Deep Search] Found ${webResults?.length || 0} web results.`);

        if (!webResults || webResults.length === 0) {
            return NextResponse.json({
                answer: "I couldn't find any relevant information on the web for that topic.",
                sources: []
            });
        }

        // 2. Construct Prompt
        const contextText = webResults
            .map((result: any, index: number) => `[${index + 1}] Source: ${result.title} (${result.url})\nContent: ${result.content.slice(0, 1500)}\n`)
            .join("\n---\n");

        const prompt = `
      You are a research assistant. Answer the user's question based ONLY on the provided web search results.
      
      Web Results:
      ${contextText}

      Question: ${query}

      Instructions:
      1. Provide a comprehensive and detailed answer.
      2. Cite your sources using the format [1], [2], etc. or [Source Name].
      3. If the results are insufficient, state that clearly.
      4. Avoid mentioning "as per the web results" or similar meta-commentary unless necessary.
    `;

        // 3. Generate Answer
        const answer = await generateAnswer(prompt);

        return NextResponse.json({
            answer,
            sources: webResults.map((r: any) => `${r.title} (${r.url})`)
        });

    } catch (error: any) {
        console.error("Deep Search Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
