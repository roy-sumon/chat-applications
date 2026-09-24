export const REALTIME_EVENTS = {
  NEW_MESSAGE: "new-message",
  MESSAGE_UPDATED: "message-updated",
  MESSAGE_DELETED: "message-deleted",
  REACTION_UPDATED: "reaction-updated",
  MESSAGES_SEEN: "messages-seen",
  TYPING: "typing",
  CONVERSATION_CREATED: "conversation-created",
  CONVERSATION_UPDATED: "conversation-updated",
  MEMBER_UPDATED: "member-updated",
} as const;

export type RealtimeEventType = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export interface RealtimeServer {
  trigger(channel: string | string[], event: string, data: unknown): Promise<void>;
  authorizeChannel(socketId: string, channel: string, presenceData?: Record<string, unknown>): unknown;
}

export interface TypingEventPayload {
  userId: string;
  userName: string;
  conversationId: string;
  isTyping: boolean;
}

export interface SeenEventPayload {
  conversationId: string;
  userId: string;
  readAt: string;
  messageIds: string[];
}

// Client-side realtime interfaces
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventCallback = (data: any) => void;

export interface RealtimeClientChannel {
  name: string;
  bind: (event: string, callback: EventCallback) => RealtimeClientChannel;
  unbind: (event?: string, callback?: EventCallback) => RealtimeClientChannel;
  unbind_all: () => RealtimeClientChannel;
}

export interface ClientRealtimeInstance {
  subscribe: (channelName: string) => RealtimeClientChannel;
  unsubscribe: (channelName: string) => void;
  disconnect?: () => void;
}
