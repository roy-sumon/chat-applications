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
    const { action, targetUserId, callType, sdp, candidate, reason } = body;

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

      case "reject":
        await realtimeServer.trigger(channels, REALTIME_EVENTS.CALL_REJECT, {
          conversationId,
          reason: reason || "declined",
        });
        break;

      case "end":
        await realtimeServer.trigger(channels, REALTIME_EVENTS.CALL_END, {
          conversationId,
        });
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Call API] Error:", error);
    return NextResponse.json({ error: "Call signaling failed" }, { status: 500 });
  }
}
