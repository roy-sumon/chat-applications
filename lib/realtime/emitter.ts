import { EventEmitter } from "events";

export interface RealtimeBroadcastEvent {
  channel: string;
  event: string;
  data: unknown;
  timestamp: number;
}

declare global {
  var globalRealtimeBus: EventEmitter | undefined;
  var globalRecentEvents: RealtimeBroadcastEvent[] | undefined;
  var globalActivePresence: Map<string, number> | undefined;
}

// Global EventBus instance across HMR in development and Node process
export const realtimeBus: EventEmitter =
  globalThis.globalRealtimeBus || new EventEmitter();

// Allow up to 200 listeners for SSE client connections
realtimeBus.setMaxListeners(200);

if (process.env.NODE_ENV !== "production") {
  globalThis.globalRealtimeBus = realtimeBus;
}

// In-memory rolling buffer for recent events (kept for 60 seconds)
export const recentEvents: RealtimeBroadcastEvent[] =
  globalThis.globalRecentEvents || [];

if (process.env.NODE_ENV !== "production") {
  globalThis.globalRecentEvents = recentEvents;
}

// In-memory active presence registry (userId -> lastSeen timestamp ms)
export const activePresence: Map<string, number> =
  globalThis.globalActivePresence || new Map();

if (process.env.NODE_ENV !== "production") {
  globalThis.globalActivePresence = activePresence;
}

export function broadcastLocalEvent(channel: string, event: string, data: unknown): void {
  const payload: RealtimeBroadcastEvent = {
    channel,
    event,
    data,
    timestamp: Date.now(),
  };

  // Add to rolling buffer
  recentEvents.push(payload);
  // Keep last 150 events and prune events older than 60s
  const cutoff = Date.now() - 60 * 1000;
  while (recentEvents.length > 150 || (recentEvents.length > 0 && recentEvents[0].timestamp < cutoff)) {
    recentEvents.shift();
  }

  // Emit on bus
  realtimeBus.emit("event", payload);
  realtimeBus.emit(`channel:${channel}`, payload);
}

export function recordUserPresence(userId: string): void {
  activePresence.set(userId, Date.now());
}

export function removeUserPresence(userId: string): void {
  activePresence.delete(userId);
}

export function getActiveUserIds(thresholdMs = 45 * 1000): string[] {
  const now = Date.now();
  const activeIds: string[] = [];
  for (const [userId, lastActive] of activePresence.entries()) {
    if (now - lastActive <= thresholdMs) {
      activeIds.push(userId);
    } else {
      activePresence.delete(userId);
    }
  }
  return activeIds;
}
