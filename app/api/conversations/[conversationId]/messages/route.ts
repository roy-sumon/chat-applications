import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getConversationMessages, createMessage } from "@/lib/db/messages";
import { sendMessageSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { realtimeServer, REALTIME_EVENTS } from "@/lib/realtime";
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
    const cursor = searchParams.get("cursor") || undefined;
    const limit = Math.min(Number(searchParams.get("limit")) || 30, 50);

    const result = await getConversationMessages(conversationId, user.id, { cursor, limit });
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[Messages API] GET error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch messages";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting: 60 messages per minute per user
    const rateLimit = checkRateLimit(`msg:${user.id}`, { limit: 60, windowMs: 60 * 1000 });
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "You are sending messages too quickly. Please wait a moment." },
        { status: 429 }
      );
    }

    const { conversationId } = await params;
    const body = await req.json();

    const validation = sendMessageSchema.safeParse({
      ...body,
      conversationId,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid message data" },
        { status: 400 }
      );
    }

    const {
      content,
      type,
      attachmentUrl,
      attachmentName,
      attachmentSize,
      attachmentType,
      replyToId,
    } = validation.data;

    const message = await createMessage({
      conversationId,
      senderId: user.id,
      content,
      type,
      attachmentUrl,
      attachmentName,
      attachmentSize,
      attachmentType,
      replyToId,
    });

    // Broadcast new message to conversation channel
    await realtimeServer.trigger(
      `presence-conversation-${conversationId}`,
      REALTIME_EVENTS.NEW_MESSAGE,
      { message }
    );

    // Notify all other members for sidebar updates
    const members = await prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });

    const otherMemberChannels = members
      .filter((m) => m.userId !== user.id)
      .map((m) => `private-user-${m.userId}`);

    if (otherMemberChannels.length > 0) {
      await realtimeServer.trigger(
        otherMemberChannels,
        REALTIME_EVENTS.CONVERSATION_UPDATED,
        {
          conversationId,
          lastMessage: message,
        }
      );
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (error: unknown) {
    console.error("[Messages API] POST error:", error);
    const message = error instanceof Error ? error.message : "Failed to send message";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
