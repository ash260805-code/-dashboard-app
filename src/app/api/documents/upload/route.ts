import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
// import PDFParser from "pdf2json"; 
// Switching to a more robust text extraction
const { PdfReader } = require("pdfreader");

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
async function parsePdf(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        let text = "";
        new PdfReader().parseBuffer(buffer, (err: any, item: any) => {
            if (err) reject(err);
            else if (!item) resolve(text);
            else if (item.text) text += item.text + " ";
        });
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
                content = await parsePdf(buffer);
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
        const document = await prisma.document.create({
            data: {
                name: file.name,
                type: file.type,
                content: content.substring(0, 1000), // Store sample of content
                userId: session.user.id,
            },
        });

        // Split into chunks for RAG
        const chunks = chunkText(content);

        // Batch create chunks
        await prisma.documentChunk.createMany({
            data: chunks.map((c) => ({
                content: c,
                documentId: document.id,
            })),
        });

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
