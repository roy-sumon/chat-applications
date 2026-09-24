import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { manageMemberSchema } from "@/lib/validation";
import { MemberRole, MessageType } from "@prisma/client";
import { realtimeServer, REALTIME_EVENTS } from "@/lib/realtime";

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
    const validation = manageMemberSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid member data" },
        { status: 400 }
      );
    }

    const { userId: newUserId } = validation.data;

    // Check if requester is Admin of the group
    const requesterMember = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
    });

    if (!requesterMember || requesterMember.role !== MemberRole.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden: Only admins can add members to this group" },
        { status: 403 }
      );
    }

    // Check if already a member
    const existingMember = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: newUserId,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "User is already a member of this conversation" },
        { status: 409 }
      );
    }

    // Add member
    const newMember = await prisma.conversationMember.create({
      data: {
        conversationId,
        userId: newUserId,
        role: MemberRole.MEMBER,
      },
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
    });

    // Create system message
    const systemMsg = await prisma.message.create({
      data: {
        conversationId,
        senderId: user.id,
        content: `${newMember.user.name} was added to the group`,
        type: MessageType.SYSTEM,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true, email: true } },
      },
    });

    // Realtime notification
    await realtimeServer.trigger(
      `presence-conversation-${conversationId}`,
      REALTIME_EVENTS.MEMBER_UPDATED,
      { member: newMember, systemMessage: systemMsg, action: "added" }
    );
    await realtimeServer.trigger(
      `presence-conversation-${conversationId}`,
      REALTIME_EVENTS.NEW_MESSAGE,
      { message: systemMsg }
    );

    return NextResponse.json({ member: newMember, systemMessage: systemMsg }, { status: 201 });
  } catch (error) {
    console.error("[Conversation Members API] POST error:", error);
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }
}

export async function DELETE(
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
    const targetUserId = searchParams.get("userId") || user.id;

    // Check requester membership
    const requester = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
    });

    if (!requester) {
      return NextResponse.json({ error: "Forbidden: Not a member" }, { status: 403 });
    }

    // If removing someone else, requester must be ADMIN
    if (targetUserId !== user.id && requester.role !== MemberRole.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden: Only admins can remove other members" },
        { status: 403 }
      );
    }

    // Target member to remove
    const targetMember = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: targetUserId,
        },
      },
      include: {
        user: { select: { name: true } },
      },
    });

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found in conversation" }, { status: 404 });
    }

    // Delete membership
    await prisma.conversationMember.delete({
      where: {
        conversationId_userId: {
          conversationId,
          userId: targetUserId,
        },
      },
    });

    // Create system message
    const isSelf = targetUserId === user.id;
    const systemMsg = await prisma.message.create({
      data: {
        conversationId,
        senderId: user.id,
        content: isSelf
          ? `${targetMember.user.name} left the group`
          : `${targetMember.user.name} was removed by admin`,
        type: MessageType.SYSTEM,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true, email: true } },
      },
    });

    // Realtime notification
    await realtimeServer.trigger(
      `presence-conversation-${conversationId}`,
      REALTIME_EVENTS.MEMBER_UPDATED,
      { userId: targetUserId, systemMessage: systemMsg, action: "removed" }
    );
    await realtimeServer.trigger(
      `presence-conversation-${conversationId}`,
      REALTIME_EVENTS.NEW_MESSAGE,
      { message: systemMsg }
    );

    return NextResponse.json({ message: "Member removed successfully", targetUserId });
  } catch (error) {
    console.error("[Conversation Members API] DELETE error:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
