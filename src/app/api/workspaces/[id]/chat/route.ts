import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { generateEmbedding, generateAnswer } from "@/lib/ai";
import { cosineSimilarity } from "@/lib/vector";
import { searchAndScrape } from "@/lib/firecrawl";

// Types for Context
interface ContextItem {
    id: string;
    content: string;
    source: string; // "Document: Filename" or "Web: Title"
    score?: number;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: workspaceId } = await params;

    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await (prisma as any).workspace.findUnique({
        where: { id: workspaceId, userId: session.user.id },
    });

    if (!workspace) {
        return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    try {
        const { message, includeWebSearch } = await req.json();

        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        // 1. Generate Query Embedding
        const queryEmbedding = await generateEmbedding(message);

        // 2. Fetch all chunks for the workspace
        // Note: For large workspaces, we should filter/limit or use a real vector DB. 
        // This in-memory approach is fine for proof-of-concept/small usages.
        const workspaceDocuments = await prisma.document.findMany({
            where: { workspaceId } as any,
            include: { chunks: true },
        });

        const allChunks = workspaceDocuments.flatMap((doc) =>
            doc.chunks.map((chunk) => ({
                ...chunk,
                docName: doc.name,
                embedding: (chunk as any).embedding_json ? JSON.parse((chunk as any).embedding_json) : [],
            }))
        );

        // 3. Rank Chunks (RAG)
        const rankedChunks = allChunks
            .map((chunk) => {
                if (!chunk.embedding || chunk.embedding.length === 0) return null;
                const score = cosineSimilarity(queryEmbedding, chunk.embedding);
                return { ...chunk, score };
            })
            .filter((chunk) => chunk !== null && chunk.score > 0.2) // Filter low relevance
            .sort((a, b) => b!.score - a!.score)
            .slice(0, 5); // Top 5 chunks

        console.log(`[Workspace Chat] Found ${rankedChunks.length} chunks for query: "${message}"`);

        const contextItems: ContextItem[] = rankedChunks.map((chunk) => ({
            id: chunk!.id,
            content: chunk!.content,
            source: `Document: ${chunk!.docName}`,
            score: chunk!.score,
        }));

        // 4. Perform Deep Search (Firecrawl) if requested
        if (includeWebSearch) {
            console.log("Deep search enabled, searching Firecrawl...");
            const webResults = await searchAndScrape(message);

            const webContextItems: ContextItem[] = (webResults as any[]).map((result: any, idx: number) => ({
                id: `web-${idx}`,
                content: result.content.slice(0, 1000), // Limit web content length
                source: `Web: ${result.title} (${result.url})`,
                score: 1.0, // Assume high relevance for now as it matches query
            }));

            contextItems.push(...webContextItems);
        }

        // 5. Construct Prompt
        const contextText = contextItems
            .map((item, index) => `[${index + 1}] Source: ${item.source}\nContent: ${item.content}\n`)
            .join("\n---\n");

        const prompt = `
      You are an intelligent assistant built to answer questions based on the provided context (Documents and Web Search results).
      
      Context:
      ${contextText}

      Question: ${message}

      Answer the question using the context above. 
      If the answer is found in the context, cite the source using the format [Source Name].
      If the context doesn't contain enough information, say "I couldn't find the answer in the provided documents."
      Do not make up information.
    `;

        // 6. Generate Answer
        const answer = await generateAnswer(prompt);

        return NextResponse.json({
            answer,
            sources: contextItems.map(item => item.source)
        });

    } catch (error) {
        console.error("Chat error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
