import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { recentEvents } from "@/lib/realtime/emitter";
import prisma from "@/lib/db/prisma";
import { REALTIME_EVENTS } from "@/lib/realtime/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const since = Number(searchParams.get("since")) || 0;
  const sinceDate = new Date(since);

  // 1. In-memory events from current server process
  const memoryEvents = recentEvents.filter((ev) => ev.timestamp > since);

  // 2. Fetch recent CallSignals from MongoDB targeting this user (guarantees cross-serverless delivery)
  let dbEvents: Array<{ channel: string; event: string; data: unknown; timestamp: number }> = [];

  try {
    const dbCallSignals = await prisma.callSignal.findMany({
      where: {
        targetUserId: user.id,
        createdAt: { gt: sinceDate },
      },
      orderBy: { createdAt: "asc" },
      take: 25,
    });

    if (dbCallSignals.length > 0) {
      const callerIds = Array.from(
        new Set(dbCallSignals.filter((s) => s.action === "offer").map((s) => s.senderId))
      );
      const callers =
        callerIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: callerIds } },
              select: { id: true, name: true, avatar: true },
            })
          : [];
      const callerMap = new Map(callers.map((c) => [c.id, c]));

      dbEvents = dbCallSignals
        .map((signal) => {
          let eventName = "";
          let data: unknown = null;

          if (signal.action === "offer") {
            eventName = REALTIME_EVENTS.CALL_OFFER;
            const caller = callerMap.get(signal.senderId) || {
              id: signal.senderId,
              name: "User",
              avatar: null,
            };
            data = {
              conversationId: signal.conversationId,
              caller,
              calleeId: signal.targetUserId,
              callType: signal.callType || "VIDEO",
              sdp: signal.sdp ? JSON.parse(signal.sdp) : undefined,
            };
          } else if (signal.action === "answer") {
            eventName = REALTIME_EVENTS.CALL_ANSWER;
            data = {
              conversationId: signal.conversationId,
              calleeId: signal.senderId,
              callerId: signal.targetUserId,
              sdp: signal.sdp ? JSON.parse(signal.sdp) : undefined,
            };
          } else if (signal.action === "ice-candidate") {
            eventName = REALTIME_EVENTS.CALL_ICE_CANDIDATE;
            data = {
              conversationId: signal.conversationId,
              senderId: signal.senderId,
              targetUserId: signal.targetUserId,
              candidate: signal.candidate ? JSON.parse(signal.candidate) : undefined,
              candidates: signal.candidates ? JSON.parse(signal.candidates) : undefined,
            };
          } else if (signal.action === "reject") {
            eventName = REALTIME_EVENTS.CALL_REJECT;
            data = {
              conversationId: signal.conversationId,
              reason: signal.reason || "declined",
            };
          } else if (signal.action === "end") {
            eventName = REALTIME_EVENTS.CALL_END;
            data = {
              conversationId: signal.conversationId,
            };
          }

          return {
            channel: `private-user-${user.id}`,
            event: eventName,
            data,
            timestamp: new Date(signal.createdAt).getTime(),
          };
        })
        .filter((e) => Boolean(e.event));
    }
  } catch (err) {
    console.error("[Realtime Sync] Error fetching DB call signals:", err);
  }

  // Merge and deduplicate
  const combined = [...memoryEvents, ...dbEvents];
  const seenKey = new Set<string>();
  const uniqueEvents = [];
  for (const ev of combined) {
    const key = `${ev.event}-${ev.timestamp}-${JSON.stringify(ev.data).slice(0, 50)}`;
    if (!seenKey.has(key)) {
      seenKey.add(key);
      uniqueEvents.push(ev);
    }
  }

  uniqueEvents.sort((a, b) => a.timestamp - b.timestamp);

  return NextResponse.json({
    events: uniqueEvents,
    serverTime: Date.now(),
  });
}
