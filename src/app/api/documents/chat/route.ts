import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateEmbedding, generateAnswer } from "@/lib/ai";
import { searchAndScrape } from "@/lib/firecrawl";
import { cosineSimilarity } from "@/lib/vector";

// Types for Context
interface ContextItem {
    id: string;
    content: string;
    source: string; // "Document: Filename" or "Web: Title"
    score?: number;
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { message, documentId, includeWebSearch } = await req.json();

        if (!message || !documentId) {
            return NextResponse.json({ error: "Missing message or documentId" }, { status: 400 });
        }

        // 1. Fetch document chunks and embeddings
        const doc = await prisma.document.findUnique({
            where: { id: documentId, userId: session.user.id },
            include: { chunks: true },
        });

        if (!doc) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        // 2. Generate Query Embedding
        const queryEmbedding = await generateEmbedding(message);

        // 3. Rank Chunks (RAG)
        const allChunks = doc.chunks.map((chunk) => ({
            ...chunk,
            embedding: (chunk as any).embedding_json ? JSON.parse((chunk as any).embedding_json) : [],
        }));

        const rankedChunks = allChunks
            .map((chunk) => {
                if (!chunk.embedding || chunk.embedding.length === 0) return null;
                return {
                    ...chunk,
                    score: cosineSimilarity(queryEmbedding, chunk.embedding),
                };
            })
            .filter((chunk) => chunk !== null && chunk.score > 0.3) // Filter low relevance
            .sort((a, b) => b!.score - a!.score)
            .slice(0, 5); // Top 5 chunks

        const contextItems: ContextItem[] = rankedChunks.map((chunk) => ({
            id: chunk!.id,
            content: chunk!.content,
            source: `Document: ${doc.name}`,
            score: chunk!.score,
        }));

        // 4. Perform Deep Search (Firecrawl) if requested
        if (includeWebSearch) {
            console.log("Deep search enabled for Quick RAG...");
            const webResults = await searchAndScrape(message);

            const webContextItems: ContextItem[] = (webResults as any[]).map((result: any, idx: number) => ({
                id: `web-${idx}`,
                content: result.content.slice(0, 1000), // Limit web content length
                source: `Web: ${result.title} (${result.url})`,
                score: 1.0,
            }));

            contextItems.push(...webContextItems);
        }

        // 5. Construct Prompt
        const contextText = contextItems
            .map((item, index) => `[${index + 1}] Source: ${item.source}\nContent: ${item.content}\n`)
            .join("\n---\n");

        const prompt = `
      You are an intelligent assistant built to answer questions based on the provided context (Document and Web Search results).
      
      Context:
      ${contextText}

      Question: ${message}

      Answer the question using the context above. 
      If the answer is found in the context, cite the source using the format [Source Name].
      If the context doesn't contain enough information, say "I couldn't find the answer in the provided document."
      Do not make up information.
    `;

        // 6. Generate Answer
        const answer = await generateAnswer(prompt);

        return NextResponse.json({
            answer,
            sources: contextItems.map(item => item.source)
        });

    } catch (error: any) {
        console.error("[Chat] Error:", error);
        return NextResponse.json({ error: error.message || "Failed to chat" }, { status: 500 });
    }
}
