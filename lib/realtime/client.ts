import PusherClient from "pusher-js";
import {
  ClientRealtimeInstance,
  RealtimeClientChannel,
  EventCallback,
} from "./types";

class LocalRealtimeChannel implements RealtimeClientChannel {
  name: string;
  private listeners: Map<string, Set<EventCallback>> = new Map();

  constructor(name: string) {
    this.name = name;
  }

  bind(event: string, callback: EventCallback): RealtimeClientChannel {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return this;
  }

  unbind(event?: string, callback?: EventCallback): RealtimeClientChannel {
    if (!event) {
      this.listeners.clear();
      return this;
    }
    if (!callback) {
      this.listeners.delete(event);
      return this;
    }
    this.listeners.get(event)?.delete(callback);
    return this;
  }

  unbind_all(): RealtimeClientChannel {
    this.listeners.clear();
    return this;
  }

  emit(event: string, data: unknown): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[Realtime Client] Error executing callback for event "${event}":`, err);
        }
      });
    }
  }
}

class UnifiedRealtimeClient implements ClientRealtimeInstance {
  private channels: Map<string, LocalRealtimeChannel> = new Map();
  private eventSource: EventSource | null = null;
  private pusherClient: PusherClient | null = null;
  private lastSyncTimestamp: number = Date.now();
  private processedEventIds: Set<string> = new Set();
  private syncTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;

  constructor() {
    if (typeof window === "undefined") return;

    // 1. Initialize Pusher if real credentials are present
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "mt1";
    if (key && key !== "dev_key" && key !== "your_pusher_key") {
      try {
        this.pusherClient = new PusherClient(key, {
          cluster,
          authEndpoint: "/api/pusher/auth",
        });
      } catch (err) {
        console.warn("[Realtime] Pusher client init warning:", err);
      }
    }

    // 2. Connect built-in zero-config SSE stream
    this.connectSSE();

    // 3. Start periodic background sync fallback (guarantees delivery across mobile sleep & serverless)
    this.startSync();
  }

  private connectSSE(): void {
    if (typeof window === "undefined" || this.eventSource || this.isConnecting) return;
    this.isConnecting = true;

    try {
      const es = new EventSource("/api/realtime/sse");
      this.eventSource = es;

      es.onopen = () => {
        this.isConnecting = false;
      };

      es.onmessage = (e) => {
        if (!e.data) return;
        try {
          const payload = JSON.parse(e.data);
          this.handleIncomingBroadcast(payload);
        } catch {
          // heartbeat comment or non-json chunk
        }
      };

      es.onerror = () => {
        this.isConnecting = false;
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        // Auto-reconnect after 3s
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connectSSE();
          }, 3000);
        }
      };
    } catch (err) {
      console.warn("[Realtime] SSE connection error:", err);
      this.isConnecting = false;
    }
  }

  private startSync(): void {
    if (typeof window === "undefined") return;

    this.syncTimer = setInterval(async () => {
      // Background sync poll: checks for missed events
      try {
        const res = await fetch(`/api/realtime/sync?since=${this.lastSyncTimestamp}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.events && Array.isArray(data.events)) {
          for (const ev of data.events) {
            this.handleIncomingBroadcast(ev);
          }
        }
        if (data.serverTime) {
          this.lastSyncTimestamp = data.serverTime;
        }
      } catch {
        // network offline, ignore
      }
    }, 2500);
  }

  private handleIncomingBroadcast(payload: {
    channel: string;
    event: string;
    data: unknown;
    timestamp?: number;
  }): void {
    if (!payload || !payload.channel || !payload.event) return;

    // Deduplicate events processed within short time window
    const eventKey = `${payload.channel}:${payload.event}:${payload.timestamp || 0}:${JSON.stringify(payload.data).slice(0, 40)}`;
    if (this.processedEventIds.has(eventKey)) return;

    this.processedEventIds.add(eventKey);
    // Prune set if large
    if (this.processedEventIds.size > 200) {
      const first = this.processedEventIds.values().next().value;
      if (first) this.processedEventIds.delete(first);
    }

    if (payload.timestamp && payload.timestamp > this.lastSyncTimestamp) {
      this.lastSyncTimestamp = payload.timestamp;
    }

    // Dispatch to matching subscribed channels
    const ch = this.channels.get(payload.channel);
    if (ch) {
      ch.emit(payload.event, payload.data);
    }
  }

  subscribe(channelName: string): RealtimeClientChannel {
    let channel = this.channels.get(channelName);
    if (!channel) {
      channel = new LocalRealtimeChannel(channelName);
      this.channels.set(channelName, channel);
    }

    // Also forward to Pusher if available
    if (this.pusherClient) {
      try {
        const pCh = this.pusherClient.subscribe(channelName);
        pCh.bind_global((eventName: string, data: unknown) => {
          channel?.emit(eventName, data);
        });
      } catch {
        // ignore
      }
    }

    // If subscribing to presence-online, fetch current online users immediately
    if (channelName === "presence-online") {
      fetch("/api/presence")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.onlineUserIds && channel) {
            const membersMap: Record<string, unknown> = {};
            data.onlineUserIds.forEach((id: string) => {
              membersMap[id] = true;
            });
            channel.emit("pusher:subscription_succeeded", {
              members: membersMap,
            });
          }
        })
        .catch(() => {});
    }

    return channel;
  }

  unsubscribe(channelName: string): void {
    const channel = this.channels.get(channelName);
    if (channel) {
      channel.unbind_all();
      this.channels.delete(channelName);
    }

    if (this.pusherClient) {
      try {
        this.pusherClient.unsubscribe(channelName);
      } catch {
        // ignore
      }
    }
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pusherClient) {
      try {
        this.pusherClient.disconnect();
      } catch {
        // ignore
      }
      this.pusherClient = null;
    }
    this.channels.clear();
  }
}

let clientInstance: UnifiedRealtimeClient | null = null;

export const getPusherClient = (): ClientRealtimeInstance | null => {
  if (typeof window === "undefined") {
    return null;
  }
  if (!clientInstance) {
    clientInstance = new UnifiedRealtimeClient();
  }
  return clientInstance;
};
