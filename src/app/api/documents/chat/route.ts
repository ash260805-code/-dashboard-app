import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { message, documentId } = await req.json();

        if (!message || !documentId) {
            return NextResponse.json({ error: "Missing message or documentId" }, { status: 400 });
        }

        // 1. Retrieval Step: Find relevant chunks
        // Simplified RAG: We use keyword matching since we don't have a vector extension yet.
        // For a true RAG in serverless without PgVector, we retrieve the most recent chunks 
        // or filter by keyword.
        const chunks = await prisma.documentChunk.findMany({
            where: {
                documentId: documentId,
                document: {
                    userId: session.user.id // Security check
                },
                content: {
                    contains: message.split(" ")[0], // Very basic keyword match for logic example
                    mode: 'insensitive'
                }
            },
            take: 5,
        });

        // Fallback: If no keyword match, just take any chunks from the document
        const relevantChunks = chunks.length > 0 ? chunks : await prisma.documentChunk.findMany({
            where: { documentId, document: { userId: session.user.id } },
            take: 5,
        });

        const context = relevantChunks.map(c => c.content).join("\n\n---\n\n");

        // 2. Augmentation & Generation
        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: `You are a helpful assistant. Use the following pieces of context to answer the user's question. 
                    If you don't know the answer based on the context, just say you don't know. 
                    
                    CONTEXT:
                    ${context}`
                },
                {
                    role: "user",
                    content: message
                }
            ],
            stream: false, // Keeping it simple for the first iteration
        });

        return NextResponse.json({
            answer: response.choices[0]?.message?.content || "No response generated.",
            contextUsed: relevantChunks.length
        });

    } catch (error: any) {
        console.error("[Chat] Error:", error);
        return NextResponse.json({ error: error.message || "Failed to chat" }, { status: 500 });
    }
}
