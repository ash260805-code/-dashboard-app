import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db"; // Assuming prisma client is exported from here
import { auth } from "@/lib/auth"; // Assuming auth is available

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaces = await prisma.workspace.findMany({
        where: {
            userId: session.user.id,
        },
        orderBy: {
            createdAt: "desc",
        },
        include: {
            _count: {
                select: { documents: true },
            },
        },
    });

    return NextResponse.json(workspaces);
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { name } = body;

        if (!name) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        const workspace = await prisma.workspace.create({
            data: {
                name,
                userId: session.user.id,
            },
        });

        return NextResponse.json(workspace);
    } catch (error) {
        console.error("Error creating workspace:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
