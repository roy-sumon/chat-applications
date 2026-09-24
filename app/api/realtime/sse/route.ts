import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { realtimeBus, RealtimeBroadcastEvent } from "@/lib/realtime/emitter";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial connection confirmation
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: "connected", userId: user.id })}\n\n`)
      );

      // 2. Broadcast listener
      const onEvent = (payload: RealtimeBroadcastEvent) => {
        try {
          const chunk = `data: ${JSON.stringify(payload)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Stream controller might have closed
        }
      };

      realtimeBus.on("event", onEvent);

      // 3. Heartbeat ping every 15 seconds to prevent browser/proxy timeouts
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(pingInterval);
        }
      }, 15000);

      // 4. Clean up listener when client disconnects
      req.signal.addEventListener("abort", () => {
        clearInterval(pingInterval);
        realtimeBus.off("event", onEvent);
        try {
          controller.close();
        } catch {
          // ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
