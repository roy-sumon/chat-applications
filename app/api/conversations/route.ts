import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getUserConversations,
  getOrCreateDirectConversation,
  createGroupConversation,
} from "@/lib/db/conversations";
import {
  createDirectConversationSchema,
  createGroupConversationSchema,
} from "@/lib/validation";
import { realtimeServer, REALTIME_EVENTS } from "@/lib/realtime";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conversations = await getUserConversations(user.id);
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("[Conversations API] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Check if group or direct conversation
    if (body.isGroup || body.memberIds) {
      const validation = createGroupConversationSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: validation.error.issues[0]?.message || "Invalid group parameters" },
          { status: 400 }
        );
      }

      const { name, memberIds, avatar } = validation.data;
      const conversation = await createGroupConversation(user.id, name, memberIds, avatar);

      // Notify all members via realtime
      const targetChannels = conversation.members.map((m) => `private-user-${m.userId}`);
      await realtimeServer.trigger(targetChannels, REALTIME_EVENTS.CONVERSATION_CREATED, {
        conversation,
      });

      return NextResponse.json({ conversation }, { status: 201 });
    } else {
      const validation = createDirectConversationSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: validation.error.issues[0]?.message || "Recipient ID is required" },
          { status: 400 }
        );
      }

      const { recipientId } = validation.data;
      const conversation = await getOrCreateDirectConversation(user.id, recipientId);

      // Notify recipient
      await realtimeServer.trigger(
        `private-user-${recipientId}`,
        REALTIME_EVENTS.CONVERSATION_CREATED,
        { conversation }
      );

      return NextResponse.json({ conversation }, { status: 201 });
    }
  } catch (error: unknown) {
    console.error("[Conversations API] POST error:", error);
    const message = error instanceof Error ? error.message : "Failed to create conversation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
