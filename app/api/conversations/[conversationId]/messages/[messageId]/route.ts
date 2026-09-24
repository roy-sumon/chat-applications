import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { editMessage, deleteMessage } from "@/lib/db/messages";
import { editMessageSchema } from "@/lib/validation";
import { realtimeServer, REALTIME_EVENTS } from "@/lib/realtime";

export async function PATCH(
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

    const validation = editMessageSchema.safeParse({
      ...body,
      messageId,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid edit data" },
        { status: 400 }
      );
    }

    const updated = await editMessage(messageId, user.id, validation.data.content);

    // Realtime broadcast to conversation channel
    await realtimeServer.trigger(
      `presence-conversation-${conversationId}`,
      REALTIME_EVENTS.MESSAGE_UPDATED,
      { message: updated }
    );

    return NextResponse.json({ message: updated });
  } catch (error: unknown) {
    console.error("[Message API] PATCH error:", error);
    const message = error instanceof Error ? error.message : "Failed to edit message";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ conversationId: string; messageId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId, messageId } = await params;
    const deleted = await deleteMessage(messageId, user.id);

    // Realtime broadcast
    await realtimeServer.trigger(
      `presence-conversation-${conversationId}`,
      REALTIME_EVENTS.MESSAGE_DELETED,
      { messageId, message: deleted }
    );

    return NextResponse.json({ message: deleted });
  } catch (error: unknown) {
    console.error("[Message API] DELETE error:", error);
    const message = error instanceof Error ? error.message : "Failed to delete message";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
