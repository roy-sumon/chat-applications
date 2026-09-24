import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { realtimeServer, REALTIME_EVENTS } from "@/lib/realtime";
import { createMessage } from "@/lib/db/messages";
import { MessageType } from "@prisma/client";
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
    const {
      action,
      targetUserId,
      callType,
      sdp,
      candidate,
      reason,
      duration,
      wasConnected,
    } = body;

    // Verify conversation membership
    const member = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const channels = targetUserId
      ? [`private-user-${targetUserId}`, `presence-conversation-${conversationId}`]
      : [`presence-conversation-${conversationId}`];

    switch (action) {
      case "offer":
        await realtimeServer.trigger(channels, REALTIME_EVENTS.CALL_OFFER, {
          conversationId,
          caller: {
            id: user.id,
            name: user.name,
            avatar: user.avatar,
          },
          calleeId: targetUserId,
          callType: callType || "VIDEO",
          sdp,
        });
        break;

      case "answer":
        await realtimeServer.trigger(channels, REALTIME_EVENTS.CALL_ANSWER, {
          conversationId,
          calleeId: user.id,
          sdp,
        });
        break;

      case "ice-candidate":
        await realtimeServer.trigger(channels, REALTIME_EVENTS.CALL_ICE_CANDIDATE, {
          conversationId,
          candidate,
        });
        break;

      case "reject": {
        await realtimeServer.trigger(channels, REALTIME_EVENTS.CALL_REJECT, {
          conversationId,
          reason: reason || "declined",
        });

        // Prevent duplicate call log messages within 4 seconds
        const recentRejectLog = await prisma.message.findFirst({
          where: {
            conversationId,
            type: MessageType.SYSTEM,
            content: { startsWith: "CALL:" },
            createdAt: { gte: new Date(Date.now() - 4000) },
          },
        });

        if (!recentRejectLog) {
          const typeStr = callType === "VIDEO" ? "VIDEO" : "AUDIO";
          const logMsg = await createMessage({
            conversationId,
            senderId: user.id,
            content: `CALL:DECLINED:${typeStr}`,
            type: MessageType.SYSTEM,
          });

          await realtimeServer.trigger(
            `presence-conversation-${conversationId}`,
            REALTIME_EVENTS.NEW_MESSAGE,
            { message: logMsg }
          );

          const members = await prisma.conversationMember.findMany({
            where: { conversationId },
            select: { userId: true },
          });

          await Promise.all(
            members.map((m) =>
              realtimeServer.trigger(
                `private-user-${m.userId}`,
                REALTIME_EVENTS.CONVERSATION_UPDATED,
                { conversationId, lastMessage: logMsg }
              )
            )
          );
        }
        break;
      }

      case "missed": {
        await realtimeServer.trigger(channels, REALTIME_EVENTS.CALL_REJECT, {
          conversationId,
          reason: "Missed call",
        });

        const recentMissedLog = await prisma.message.findFirst({
          where: {
            conversationId,
            type: MessageType.SYSTEM,
            content: { startsWith: "CALL:" },
            createdAt: { gte: new Date(Date.now() - 4000) },
          },
        });

        if (!recentMissedLog) {
          const typeStr = callType === "VIDEO" ? "VIDEO" : "AUDIO";
          const logMsg = await createMessage({
            conversationId,
            senderId: user.id,
            content: `CALL:MISSED:${typeStr}`,
            type: MessageType.SYSTEM,
          });

          await realtimeServer.trigger(
            `presence-conversation-${conversationId}`,
            REALTIME_EVENTS.NEW_MESSAGE,
            { message: logMsg }
          );

          const members = await prisma.conversationMember.findMany({
            where: { conversationId },
            select: { userId: true },
          });

          await Promise.all(
            members.map((m) =>
              realtimeServer.trigger(
                `private-user-${m.userId}`,
                REALTIME_EVENTS.CONVERSATION_UPDATED,
                { conversationId, lastMessage: logMsg }
              )
            )
          );
        }
        break;
      }

      case "end": {
        await realtimeServer.trigger(channels, REALTIME_EVENTS.CALL_END, {
          conversationId,
        });

        // Prevent duplicate call log messages within 4 seconds
        const recentEndLog = await prisma.message.findFirst({
          where: {
            conversationId,
            type: MessageType.SYSTEM,
            content: { startsWith: "CALL:" },
            createdAt: { gte: new Date(Date.now() - 4000) },
          },
        });

        if (!recentEndLog) {
          const typeStr = callType === "VIDEO" ? "VIDEO" : "AUDIO";
          let callContent: string;
          if (wasConnected && duration && duration > 0) {
            callContent = `CALL:ENDED:${typeStr}:${Math.round(duration)}`;
          } else {
            callContent = `CALL:MISSED:${typeStr}`;
          }

          const logMsg = await createMessage({
            conversationId,
            senderId: user.id,
            content: callContent,
            type: MessageType.SYSTEM,
          });

          await realtimeServer.trigger(
            `presence-conversation-${conversationId}`,
            REALTIME_EVENTS.NEW_MESSAGE,
            { message: logMsg }
          );

          const members = await prisma.conversationMember.findMany({
            where: { conversationId },
            select: { userId: true },
          });

          await Promise.all(
            members.map((m) =>
              realtimeServer.trigger(
                `private-user-${m.userId}`,
                REALTIME_EVENTS.CONVERSATION_UPDATED,
                { conversationId, lastMessage: logMsg }
              )
            )
          );
        }
        break;
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Call API] Error:", error);
    return NextResponse.json({ error: "Call signaling failed" }, { status: 500 });
  }
}
