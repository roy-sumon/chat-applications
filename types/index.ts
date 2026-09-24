export type ConversationType = "DIRECT" | "GROUP";
export type MemberRole = "ADMIN" | "MEMBER";
export type MessageType = "TEXT" | "IMAGE" | "FILE" | "SYSTEM";
export type MessageStatus = "sending" | "sent" | "delivered" | "seen";

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  bio?: string | null;
  lastSeen?: string | Date | null;
}

export interface ConversationMemberWithUser {
  id: string;
  conversationId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string | Date;
  user: UserSummary;
}

export interface ReactionDetail {
  id: string;
  messageId: string;
  userId: string;
  reaction: string;
  createdAt?: string | Date;
  user?: {
    id: string;
    name: string;
  };
}

export interface ReadReceiptDetail {
  id: string;
  messageId: string;
  userId: string;
  readAt: string | Date;
}

export interface ReplyMessageSummary {
  id: string;
  content: string | null;
  senderId: string;
  deletedAt?: string | Date | null;
  sender: {
    name: string;
  };
}

export interface MessageWithDetails {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  type: MessageType;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
  attachmentType?: string | null;
  replyToId?: string | null;
  replyTo?: ReplyMessageSummary | null;
  editedAt?: string | Date | null;
  deletedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  sender: UserSummary;
  reactions: ReactionDetail[];
  readReceipts: ReadReceiptDetail[];
  isOptimistic?: boolean;
  status?: MessageStatus;
}

export interface ConversationWithDetails {
  id: string;
  type: ConversationType;
  name?: string | null;
  avatar?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  members: ConversationMemberWithUser[];
  lastMessage?: MessageWithDetails | null;
  unreadCount?: number;
}
