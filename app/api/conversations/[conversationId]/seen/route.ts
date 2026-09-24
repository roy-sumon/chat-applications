import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { markMessagesAsSeen } from "@/lib/db/messages";
import { realtimeServer, REALTIME_EVENTS } from "@/lib/realtime";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;
    const result = await markMessagesAsSeen(conversationId, user.id);

    if (result.count > 0) {
      // Broadcast seen event
      await realtimeServer.trigger(
        `presence-conversation-${conversationId}`,
        REALTIME_EVENTS.MESSAGES_SEEN,
        {
          conversationId,
          userId: user.id,
          messageIds: result.messageIds,
          readAt: new Date().toISOString(),
        }
      );
    }

    return NextResponse.json({ success: true, count: result.count });
  } catch (error: unknown) {
    console.error("[Seen API] POST error:", error);
    const message = error instanceof Error ? error.message : "Failed to mark seen";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
