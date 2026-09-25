export const REALTIME_EVENTS = {
  NEW_MESSAGE: "new-message",
  MESSAGE_UPDATED: "message-updated",
  MESSAGE_DELETED: "message-deleted",
  REACTION_UPDATED: "reaction-updated",
  MESSAGES_SEEN: "messages-seen",
  TYPING: "typing",
  CONVERSATION_CREATED: "conversation-created",
  CONVERSATION_UPDATED: "conversation-updated",
  CONVERSATION_DELETED: "conversation-deleted",
  MEMBER_UPDATED: "member-updated",
  // WebRTC Call Signaling Events
  CALL_OFFER: "call-offer",
  CALL_ANSWER: "call-answer",
  CALL_ICE_CANDIDATE: "call-ice-candidate",
  CALL_REJECT: "call-reject",
  CALL_END: "call-end",
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

export type CallType = "AUDIO" | "VIDEO";

export interface CallOfferPayload {
  conversationId: string;
  caller: {
    id: string;
    name: string;
    avatar?: string | null;
  };
  calleeId: string;
  callType: CallType;
  sdp: RTCSessionDescriptionInit;
}

export interface CallAnswerPayload {
  conversationId: string;
  calleeId: string;
  callerId?: string;
  sdp: RTCSessionDescriptionInit;
}

export interface CallIceCandidatePayload {
  conversationId: string;
  senderId?: string;
  targetUserId?: string;
  candidate: RTCIceCandidateInit;
}

export interface CallRejectPayload {
  conversationId: string;
  reason?: string;
}

export interface CallEndPayload {
  conversationId: string;
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
