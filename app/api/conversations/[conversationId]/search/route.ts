import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim();

    if (!query) {
      return NextResponse.json({ messages: [] });
    }

    // Verify membership
    const member = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Forbidden: Not a member" }, { status: 403 });
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        content: {
          contains: query,
          mode: "insensitive",
        },
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("[Message Search API] GET error:", error);
    return NextResponse.json({ error: "Failed to search messages" }, { status: 500 });
  }
}
