import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { realtimeServer } from "@/lib/realtime";
import prisma from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const socketId = formData.get("socket_id") as string;
    const channelName = formData.get("channel_name") as string;

    if (!socketId || !channelName) {
      return NextResponse.json(
        { error: "socket_id and channel_name are required" },
        { status: 400 }
      );
    }

    // Verify channel permissions
    if (channelName.startsWith("presence-conversation-")) {
      const conversationId = channelName.replace("presence-conversation-", "");
      const membership = await prisma.conversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId: user.id,
          },
        },
      });

      if (!membership) {
        return NextResponse.json(
          { error: "Forbidden: You are not a member of this conversation" },
          { status: 403 }
        );
      }
    } else if (channelName.startsWith("private-user-")) {
      const targetUserId = channelName.replace("private-user-", "");
      if (targetUserId !== user.id) {
        return NextResponse.json(
          { error: "Forbidden: Cannot subscribe to another user's private channel" },
          { status: 403 }
        );
      }
    }

    const presenceData = {
      user_id: user.id,
      user_info: {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        email: user.email,
      },
    };

    const authResponse = realtimeServer.authorizeChannel(socketId, channelName, presenceData);
    return NextResponse.json(authResponse);
  } catch (error) {
    console.error("[Pusher Auth API] Error authorizing channel:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
