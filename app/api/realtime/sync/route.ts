import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { recentEvents } from "@/lib/realtime/emitter";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const since = Number(searchParams.get("since")) || 0;

  const filtered = recentEvents.filter((ev) => ev.timestamp > since);

  return NextResponse.json({
    events: filtered,
    serverTime: Date.now(),
  });
}
