import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { recordUserPresence, getActiveUserIds } from "@/lib/realtime/emitter";
import { realtimeServer } from "@/lib/realtime/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const threshold = new Date(Date.now() - 45 * 1000);

  // 1. Query MongoDB users active in last 45s
  const dbUsers = await prisma.user.findMany({
    where: {
      lastSeen: { gte: threshold },
    },
    select: { id: true },
  });

  // 2. Query in-memory active registry
  const memoryUserIds = getActiveUserIds(45 * 1000);

  const set = new Set<string>([
    user.id, // Current user is always online
    ...dbUsers.map((u) => u.id),
    ...memoryUserIds,
  ]);

  return NextResponse.json({
    onlineUserIds: Array.from(set),
  });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // 1. Update in memory
  recordUserPresence(user.id);

  // 2. Update MongoDB lastSeen
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeen: now },
      select: { id: true },
    });
  } catch (err) {
    console.error("[Presence API] Failed to update lastSeen:", err);
  }

  // 3. Broadcast to presence channel so other clients see active state immediately
  await realtimeServer.trigger("presence-online", "pusher:member_added", {
    id: user.id,
    info: { name: user.name, avatar: user.avatar },
  });

  const threshold = new Date(Date.now() - 45 * 1000);
  const dbUsers = await prisma.user.findMany({
    where: { lastSeen: { gte: threshold } },
    select: { id: true },
  });
  const memoryUserIds = getActiveUserIds(45 * 1000);
  const set = new Set<string>([
    user.id,
    ...dbUsers.map((u) => u.id),
    ...memoryUserIds,
  ]);

  return NextResponse.json({
    success: true,
    onlineUserIds: Array.from(set),
  });
}
