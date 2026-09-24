import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { realtimeServer, REALTIME_EVENTS } from "@/lib/realtime";
import prisma from "@/lib/db/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;
    const body = await req.json();
    const isTyping = Boolean(body.isTyping);

    // Verify membership without heavy queries
    const member = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
      select: { id: true },
    });

    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Trigger typing event to conversation channel without saving to MongoDB
    await realtimeServer.trigger(
      `presence-conversation-${conversationId}`,
      REALTIME_EVENTS.TYPING,
      {
        userId: user.id,
        userName: user.name,
        conversationId,
        isTyping,
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Typing API] POST error:", error);
    return NextResponse.json({ error: "Failed to broadcast typing" }, { status: 500 });
  }
}
