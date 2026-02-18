import { NextRequest, NextResponse } from "next/server";
// If you see type errors here (e.g., 'Property workspace does not exist'), please restart your TS Server or VS Code. The build is passing.
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { generateEmbedding } from "@/lib/ai";
import PDFParser from "pdf2json";

// Helper to parse PDF buffer
async function parsePDF(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser(null, true); // true = text only

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

// Helper to chunk text
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
        const end = start + chunkSize;
        chunks.push(text.slice(start, end));
        start += chunkSize - overlap;
    }
    return chunks;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: workspaceId } = await params;

    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify workspace access
    const workspace = await (prisma as any).workspace.findUnique({
        where: { id: workspaceId, userId: session.user.id },
    });

    if (!workspace) {
        return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        let content = "";

        if (file.type === "application/pdf") {
            content = await parsePDF(buffer);
        } else if (file.type === "text/plain" || file.type === "text/markdown") {
            content = buffer.toString("utf-8");
        } else {
            return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
        }

        if (!content.trim()) {
            return NextResponse.json({ error: "File is empty or could not be parsed" }, { status: 400 });
        }

        // Save Document
        const document = await prisma.document.create({
            data: {
                name: file.name,
                type: file.type,
                content: content, // Store full content for reference (optional)
                workspaceId,
                userId: session.user.id,
            } as any,
        });

        // Chunk and Embed
        const chunks = chunkText(content);
        const chunkPromises = chunks.map(async (chunkText) => {
            const embedding = await generateEmbedding(chunkText);
            return prisma.documentChunk.create({
                data: {
                    content: chunkText,
                    documentId: document.id,
                    embedding_json: JSON.stringify(embedding),
                } as any,
            });
        });

        await Promise.all(chunkPromises);

        return NextResponse.json({ success: true, documentId: document.id, chunks: chunks.length });

    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
