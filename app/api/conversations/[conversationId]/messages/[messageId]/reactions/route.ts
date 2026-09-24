import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { toggleMessageReaction } from "@/lib/db/messages";
import { reactionSchema } from "@/lib/validation";
import { realtimeServer, REALTIME_EVENTS } from "@/lib/realtime";
import prisma from "@/lib/db/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string; messageId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId, messageId } = await params;
    const body = await req.json();

    const validation = reactionSchema.safeParse({
      ...body,
      messageId,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid reaction" },
        { status: 400 }
      );
    }

    const result = await toggleMessageReaction(messageId, user.id, validation.data.reaction);

    // Fetch refreshed reactions for this message to broadcast
    const reactions = await prisma.messageReaction.findMany({
      where: { messageId },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    // Realtime notification
    await realtimeServer.trigger(
      `presence-conversation-${conversationId}`,
      REALTIME_EVENTS.REACTION_UPDATED,
      {
        messageId,
        reactions,
      }
    );

    return NextResponse.json({ ...result, reactions });
  } catch (error: unknown) {
    console.error("[Reactions API] POST error:", error);
    const message = error instanceof Error ? error.message : "Failed to toggle reaction";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
