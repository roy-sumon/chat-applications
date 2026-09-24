import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getConversationById } from "@/lib/db/conversations";
import prisma from "@/lib/db/prisma";
import { updateGroupSchema } from "@/lib/validation";
import { MemberRole } from "@prisma/client";
import { realtimeServer, REALTIME_EVENTS } from "@/lib/realtime";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;
    const conversation = await getConversationById(conversationId, user.id);

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found or access denied" },
        { status: 404 }
      );
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error("[Conversation API] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch conversation" }, { status: 500 });
  }
}

export async function PATCH(
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
    const validation = updateGroupSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid update data" },
        { status: 400 }
      );
    }

    // Check admin role
    const member = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
    });

    if (!member || member.role !== MemberRole.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden: Only group administrators can edit group settings" },
        { status: 403 }
      );
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        ...(validation.data.name && { name: validation.data.name }),
        ...(validation.data.avatar !== undefined && { avatar: validation.data.avatar }),
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                bio: true,
                lastSeen: true,
              },
            },
          },
        },
      },
    });

    // Notify channel
    await realtimeServer.trigger(
      `presence-conversation-${conversationId}`,
      REALTIME_EVENTS.CONVERSATION_UPDATED,
      { conversation: updated }
    );

    return NextResponse.json({ conversation: updated });
  } catch (error) {
    console.error("[Conversation API] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 });
  }
}
