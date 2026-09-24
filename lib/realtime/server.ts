import PusherServer from "pusher";
import { RealtimeServer, REALTIME_EVENTS } from "./types";
import { broadcastLocalEvent } from "./emitter";

class UnifiedRealtimeServer implements RealtimeServer {
  private pusher: PusherServer | null = null;
  private isPusherConfigured: boolean = false;

  constructor() {
    const appId = process.env.PUSHER_APP_ID;
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const secret = process.env.PUSHER_SECRET;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "mt1";

    if (appId && key && secret && appId !== "your_pusher_app_id" && appId !== "dev_app_id") {
      try {
        this.pusher = new PusherServer({
          appId,
          key,
          secret,
          cluster,
          useTLS: true,
        });
        this.isPusherConfigured = true;
      } catch (err) {
        console.warn("[Realtime] Failed to initialize Pusher server instance:", err);
      }
    }
  }

  async trigger(channel: string | string[], event: string, data: unknown): Promise<void> {
    // 1. Broadcast to local EventBus for instant (<5ms) SSE & multi-tab delivery
    const channels = Array.isArray(channel) ? channel : [channel];
    for (const ch of channels) {
      broadcastLocalEvent(ch, event, data);
    }

    // 2. Broadcast via Pusher if configured (trigger individually to prevent Pusher 400 on presence channels)
    if (this.isPusherConfigured && this.pusher) {
      await Promise.allSettled(
        channels.map((ch) =>
          this.pusher!.trigger(ch, event, data).catch((error) => {
            console.error(`[Realtime] Pusher trigger failed for event "${event}" on channel "${ch}":`, error);
          })
        )
      );
    }
  }

  authorizeChannel(socketId: string, channel: string, presenceData?: Record<string, unknown>): unknown {
    if (!this.isPusherConfigured || !this.pusher) {
      return { auth: `${socketId}:${Date.now()}` };
    }
    if (channel.startsWith("presence-") && presenceData) {
      return this.pusher.authorizeChannel(socketId, channel, {
        user_id: presenceData.user_id as string,
        user_info: (presenceData.user_info as Record<string, unknown>) || {},
      });
    }
    return this.pusher.authorizeChannel(socketId, channel);
  }
}

// Export singleton instance of RealtimeServer
export const realtimeServer: RealtimeServer = new UnifiedRealtimeServer();
export { REALTIME_EVENTS };
