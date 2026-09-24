import PusherServer from "pusher";
import { RealtimeServer, REALTIME_EVENTS } from "./types";

class PusherRealtimeServer implements RealtimeServer {
  private pusher: PusherServer | null = null;
  private isConfigured: boolean = false;

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
        this.isConfigured = true;
      } catch (err) {
        console.warn("[Realtime] Failed to initialize Pusher server instance:", err);
      }
    } else {
      if (process.env.NODE_ENV !== "production") {
        console.info(
          "[Realtime] Pusher credentials not configured or using placeholders. Running in fallback no-op mode."
        );
      }
    }
  }

  async trigger(channel: string | string[], event: string, data: unknown): Promise<void> {
    if (!this.isConfigured || !this.pusher) {
      return;
    }
    try {
      await this.pusher.trigger(channel, event, data);
    } catch (error) {
      console.error(`[Realtime] Failed to trigger event "${event}" on channel "${channel}":`, error);
    }
  }

  authorizeChannel(socketId: string, channel: string, presenceData?: Record<string, unknown>): unknown {
    if (!this.isConfigured || !this.pusher) {
      return { auth: "mock-auth-token" };
    }
    if (channel.startsWith("presence-") && presenceData) {
      return this.pusher.authorizeChannel(socketId, channel, {
        user_id: presenceData.user_id as string,
        user_info: presenceData.user_info,
      });
    }
    return this.pusher.authorizeChannel(socketId, channel);
  }
}

// Export singleton instance of RealtimeServer
export const realtimeServer: RealtimeServer = new PusherRealtimeServer();
export { REALTIME_EVENTS };
