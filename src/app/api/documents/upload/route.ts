import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateEmbedding } from "@/lib/ai";

/**
 * Basic chunking utility for RAG
 */
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.substring(start, end));
        start += chunkSize - overlap;
    }

    return chunks;
}

// Helper to parse PDF buffer
async function parsePDF(buffer: Buffer): Promise<string> {
    const PDFParser = require("pdf2json");
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser(null, true);

        pdfParser.on("pdfParser_dataError", (errData: any) =>
            reject(new Error(errData.parserError))
        );

        pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
            const text = pdfParser.getRawTextContent();
            resolve(text);
        });

        pdfParser.parseBuffer(buffer);
    });
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        let content = "";

        if (file.type === "application/pdf") {
            try {
                content = await parsePDF(buffer);
            } catch (e: any) {
                console.error("PDF Parse Error:", e);
                return NextResponse.json({ error: "Failed to parse PDF file." }, { status: 400 });
            }
        } else if (file.type === "text/plain") {
            content = buffer.toString("utf-8");
        } else {
            return NextResponse.json({ error: "Unsupported file type. Use PDF or TXT." }, { status: 400 });
        }

        if (!content || content.trim().length === 0) {
            return NextResponse.json({ error: "File is empty or could not be parsed." }, { status: 400 });
        }

        // Create the Document record
        // @ts-ignore
        const document = await (prisma as any).document.create({
            data: {
                name: file.name,
                type: file.type,
                content: content,
                userId: session.user.id,
            },
        });

        // Split into chunks for RAG
        const chunks = chunkText(content);

        // Generate embeddings and Save (Sequential or limited parallel for stability)
        const chunkPromises = chunks.map(async (text) => {
            const embedding = await generateEmbedding(text);
            // @ts-ignore
            return (prisma as any).documentChunk.create({
                data: {
                    content: text,
                    documentId: document.id,
                    embedding_json: JSON.stringify(embedding),
                },
            });
        });

        await Promise.all(chunkPromises);

        return NextResponse.json({
            message: "File uploaded and processed successfully",
            documentId: document.id,
            chunkCount: chunks.length
        });

    } catch (error: any) {
        console.error("[Upload] Error:", error);
        return NextResponse.json({ error: error.message || "Failed to process document" }, { status: 500 });
    }
}
