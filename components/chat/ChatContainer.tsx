"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ConversationWithDetails,
  MessageWithDetails,
  UserSummary,
  ReactionDetail,
} from "@/types";
import { ConversationSidebar } from "./ConversationSidebar";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { ConversationSearch } from "./ConversationSearch";
import { NewChatModal } from "./NewChatModal";
import { NewGroupModal } from "./NewGroupModal";
import { GroupDetailsModal } from "./GroupDetailsModal";
import { ProfileModal } from "./ProfileModal";
import { CallModal, CallStatus } from "./CallModal";
import { useRealtimeContext } from "@/components/providers/RealtimeProvider";
import {
  REALTIME_EVENTS,
  TypingEventPayload,
  SeenEventPayload,
  CallOfferPayload,
  CallAnswerPayload,
  CallIceCandidatePayload,
  CallRejectPayload,
} from "@/lib/realtime/types";
import { useToast } from "@/components/providers/ToastProvider";
import { playReceiveSound, stopAllRingtones } from "@/lib/utils/sound";
import { MessageSquare, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface ChatContainerProps {
  initialUser: UserSummary;
  initialConversations: ConversationWithDetails[];
  initialSelectedId?: string | null;
}

export function ChatContainer({
  initialUser,
  initialConversations,
  initialSelectedId,
}: ChatContainerProps) {
  const [currentUser, setCurrentUser] = useState<UserSummary>(initialUser);
  const [conversations, setConversations] =
    useState<ConversationWithDetails[]>(initialConversations);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    initialSelectedId || (initialConversations.length > 0 ? initialConversations[0].id : null)
  );

  // Active conversation message state
  const [messages, setMessages] = useState<MessageWithDetails[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [activeTypingMap, setActiveTypingMap] = useState<Record<string, string[]>>({});

  // Input states
  const [replyingTo, setReplyingTo] = useState<MessageWithDetails | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageWithDetails | null>(null);
  const [isSearchingInChat, setIsSearchingInChat] = useState(false);

  // Modals
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [isGroupDetailsOpen, setIsGroupDetailsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<ConversationWithDetails | null>(null);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);

  // WebRTC Call State
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [activeCallType, setActiveCallType] = useState<"AUDIO" | "VIDEO">("VIDEO");
  const [callingTarget, setCallingTarget] = useState<{
    id: string;
    name: string;
    avatar?: string | null;
  } | null>(null);
  const [incomingOfferSdp, setIncomingOfferSdp] = useState<RTCSessionDescriptionInit | null>(null);
  const [remoteAnswerSdp, setRemoteAnswerSdp] = useState<RTCSessionDescriptionInit | null>(null);
  const [pendingIceCandidates, setPendingIceCandidates] = useState<RTCIceCandidateInit[]>([]);
  const [callConversationId, setCallConversationId] = useState<string | null>(null);
  const callStatusRef = useRef<CallStatus>("idle");
  const selectedConversationIdRef = useRef(selectedConversationId);

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  // Mobile navigation state: show sidebar or active chat
  const [mobileView, setMobileView] = useState<"list" | "chat">(
    initialSelectedId ? "chat" : "list"
  );

  const { pusherClient, isUserOnline } = useRealtimeContext();
  const { toast } = useToast();
  const typingTimerMapRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Find active conversation
  const activeConversation = conversations.find(
    (c) => c.id === selectedConversationId
  );

  // WebRTC Call Signaling sender
  const handleSendCallSignal = useCallback(
    async (payload: {
      action: "offer" | "answer" | "ice-candidate" | "reject" | "missed" | "end";
      targetUserId: string;
      callType?: "AUDIO" | "VIDEO";
      sdp?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
      reason?: string;
      duration?: number;
      wasConnected?: boolean;
    }) => {
      const convId = callConversationId || selectedConversationId;
      if (!convId) return;

      try {
        await fetch(`/api/conversations/${convId}/call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.error("Failed to send call signal:", err);
      }
    },
    [callConversationId, selectedConversationId]
  );

  const handleStartCall = useCallback(
    (type: "AUDIO" | "VIDEO") => {
      if (!activeConversation) return;

      const otherMember = activeConversation.members?.find(
        (m) => m.userId !== currentUser.id
      );

      if (!otherMember || !otherMember.user) {
        toast.error("Participant not found for call", "Cannot Call");
        return;
      }

      setCallConversationId(activeConversation.id);
      setCallingTarget({
        id: otherMember.user.id,
        name: otherMember.user.name,
        avatar: otherMember.user.avatar,
      });
      setActiveCallType(type);
      setIncomingOfferSdp(null);
      setRemoteAnswerSdp(null);
      setPendingIceCandidates([]);
      setCallStatus("calling");
    },
    [activeConversation, currentUser.id, toast]
  );

  const handleAcceptIncoming = useCallback(() => {
    setCallStatus("connected");
  }, []);

  const handleRejectIncoming = useCallback(async () => {
    stopAllRingtones();
    if (callingTarget && (callConversationId || selectedConversationId)) {
      await handleSendCallSignal({
        action: "reject",
        targetUserId: callingTarget.id,
        callType: activeCallType,
        reason: "Call declined",
      });
    }
    setCallStatus("idle");
    setCallingTarget(null);
    setIncomingOfferSdp(null);
    setRemoteAnswerSdp(null);
    setPendingIceCandidates([]);
    setCallConversationId(null);
  }, [callingTarget, callConversationId, selectedConversationId, activeCallType, handleSendCallSignal]);

  const handleEndCall = useCallback(
    async (details?: { wasConnected: boolean; duration: number }) => {
      stopAllRingtones();
      const wasConn = details?.wasConnected ?? (callStatusRef.current === "connected");
      const dur = details?.duration ?? 0;

      if (callingTarget && (callConversationId || selectedConversationId)) {
        await handleSendCallSignal({
          action: "end",
          targetUserId: callingTarget.id,
          callType: activeCallType,
          wasConnected: wasConn,
          duration: dur,
        });
      }
      setCallStatus("idle");
      setCallingTarget(null);
      setIncomingOfferSdp(null);
      setRemoteAnswerSdp(null);
      setPendingIceCandidates([]);
      setCallConversationId(null);
    },
    [callingTarget, callConversationId, selectedConversationId, activeCallType, handleSendCallSignal]
  );

  // 1. Mark messages as seen
  const markAsSeen = useCallback(
    async (convId: string) => {
      try {
        await fetch(`/api/conversations/${convId}/seen`, { method: "POST" });
        // Update local conversation unread count
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
        );
      } catch {
        // ignore seen errors
      }
    },
    []
  );

  // 2. Fetch messages when active conversation changes
  const fetchMessages = useCallback(
    async (convId: string) => {
      setIsLoadingMessages(true);
      setReplyingTo(null);
      setEditingMessage(null);
      setIsSearchingInChat(false);
      setTypingUsers([]);

      try {
        const res = await fetch(`/api/conversations/${convId}/messages?limit=30`);
        const data = await res.json();
        if (res.ok) {
          setMessages(data.messages || []);
          setCursor(data.nextCursor || null);
          markAsSeen(convId);
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [markAsSeen]
  );

  useEffect(() => {
    if (selectedConversationId) {
      fetchMessages(selectedConversationId);
    } else {
      setMessages([]);
    }
  }, [selectedConversationId, fetchMessages]);

  // 3. Load older messages (Pagination)
  const handleLoadMore = async () => {
    if (!selectedConversationId || !cursor || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const res = await fetch(
        `/api/conversations/${selectedConversationId}/messages?cursor=${cursor}&limit=30`
      );
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [...(data.messages || []), ...prev]);
        setCursor(data.nextCursor || null);
      }
    } catch (err) {
      console.error("Failed to load more messages:", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // 3.5 Refresh conversations list from API
  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      const data = await res.json();
      if (res.ok) {
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error("Failed to refresh conversations:", err);
    }
  }, []);

  // 4. Real-time subscription to active conversation channel
  useEffect(() => {
    if (!pusherClient || !selectedConversationId) return;

    const channelName = `presence-conversation-${selectedConversationId}`;
    const channel = pusherClient.subscribe(channelName);

    // Event: new-message
    channel.bind(REALTIME_EVENTS.NEW_MESSAGE, (data: { message: MessageWithDetails }) => {
      setMessages((prev) => {
        // Avoid duplicate if optimistic message was added
        const exists = prev.some((m) => m.id === data.message.id);
        if (exists) return prev;
        // Filter out optimistic counterpart if any
        const filtered = prev.filter((m) => !m.isOptimistic);
        return [...filtered, data.message];
      });

      // Update sidebar last message and bring to top
      setConversations((prev) => {
        const target = prev.find((c) => c.id === selectedConversationId);
        if (!target) return prev;
        const updated = { ...target, lastMessage: data.message, updatedAt: new Date() };
        const others = prev.filter((c) => c.id !== selectedConversationId);
        return [updated, ...others];
      });

      // If sent by someone else and active, mark seen and play sound (skip for call system logs)
      if (data.message.senderId !== currentUser.id) {
        markAsSeen(selectedConversationId);
        if (!data.message.content?.startsWith("CALL:")) {
          playReceiveSound();
        }
      }
    });

    // Event: message-updated
    channel.bind(REALTIME_EVENTS.MESSAGE_UPDATED, (data: { message: MessageWithDetails }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === data.message.id ? data.message : m))
      );
    });

    // Event: message-deleted
    channel.bind(REALTIME_EVENTS.MESSAGE_DELETED, (data: { messageId: string; message: MessageWithDetails }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === data.messageId ? data.message : m))
      );
    });

    // Event: reaction-updated
    channel.bind(
      REALTIME_EVENTS.REACTION_UPDATED,
      (data: { messageId: string; reactions: ReactionDetail[] }) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.messageId ? { ...m, reactions: data.reactions } : m
          )
        );
      }
    );

    // Event: messages-seen
    channel.bind(REALTIME_EVENTS.MESSAGES_SEEN, (data: SeenEventPayload) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (data.messageIds.includes(m.id)) {
            const hasReceipt = m.readReceipts?.some((r) => r.userId === data.userId);
            if (!hasReceipt) {
              return {
                ...m,
                readReceipts: [
                  ...(m.readReceipts || []),
                  { id: `${m.id}-${data.userId}`, messageId: m.id, userId: data.userId, readAt: data.readAt },
                ],
              };
            }
          }
          return m;
        })
      );
    });

    // Event: typing
    channel.bind(REALTIME_EVENTS.TYPING, (payload: TypingEventPayload) => {
      if (payload.userId === currentUser.id) return;

      const userName = payload.userName || "Someone";
      const convId = payload.conversationId || selectedConversationId;

      if (payload.isTyping) {
        setTypingUsers((prev) => (prev.includes(userName) ? prev : [...prev, userName]));
        if (convId) {
          setActiveTypingMap((prev) => ({
            ...prev,
            [convId]: Array.from(new Set([...(prev[convId] || []), userName])),
          }));
        }

        // Clear existing timeout for this user
        if (typingTimerMapRef.current.has(payload.userId)) {
          clearTimeout(typingTimerMapRef.current.get(payload.userId)!);
        }

        // Auto remove typing status after 4 seconds of inactivity
        const timer = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((name) => name !== userName));
          if (convId) {
            setActiveTypingMap((prev) => ({
              ...prev,
              [convId]: (prev[convId] || []).filter((name) => name !== userName),
            }));
          }
          typingTimerMapRef.current.delete(payload.userId);
        }, 4000);

        typingTimerMapRef.current.set(payload.userId, timer);
      } else {
        if (typingTimerMapRef.current.has(payload.userId)) {
          clearTimeout(typingTimerMapRef.current.get(payload.userId)!);
          typingTimerMapRef.current.delete(payload.userId);
        }
        setTypingUsers((prev) => prev.filter((name) => name !== userName));
        if (convId) {
          setActiveTypingMap((prev) => ({
            ...prev,
            [convId]: (prev[convId] || []).filter((name) => name !== userName),
          }));
        }
      }
    });

    // Event: member-updated
    channel.bind(REALTIME_EVENTS.MEMBER_UPDATED, () => {
      // Refresh active conversation details
      refreshConversations();
    });

    // Event: conversation-deleted
    channel.bind(
      REALTIME_EVENTS.CONVERSATION_DELETED,
      (data: { conversationId: string }) => {
        setConversations((prev) => prev.filter((c) => c.id !== data.conversationId));
        if (selectedConversationIdRef.current === data.conversationId) {
          setSelectedConversationId(null);
          setMessages([]);
          setMobileView("list");
        }
      }
    );

    // WebRTC signaling over conversation channel (redundant delivery path)
    channel.bind(REALTIME_EVENTS.CALL_ANSWER, (data: CallAnswerPayload) => {
      if (data.calleeId !== currentUser.id) {
        stopAllRingtones();
        setRemoteAnswerSdp(data.sdp);
        setCallStatus("connected");
      }
    });

    channel.bind(REALTIME_EVENTS.CALL_ICE_CANDIDATE, (data: CallIceCandidatePayload) => {
      if (data.senderId && data.senderId === currentUser.id) return;
      if (data.candidate) {
        setPendingIceCandidates((prev) => [...prev, data.candidate]);
      }
    });

    channel.bind(REALTIME_EVENTS.CALL_REJECT, (data: CallRejectPayload) => {
      stopAllRingtones();
      toast.error(data.reason || "The call was declined.", "Call Declined");
      setCallStatus("idle");
      setCallingTarget(null);
      setIncomingOfferSdp(null);
      setRemoteAnswerSdp(null);
      setPendingIceCandidates([]);
      setCallConversationId(null);
    });

    channel.bind(REALTIME_EVENTS.CALL_END, () => {
      stopAllRingtones();
      toast.info("Call ended by remote user.", "Call Ended");
      setCallStatus("idle");
      setCallingTarget(null);
      setIncomingOfferSdp(null);
      setRemoteAnswerSdp(null);
      setPendingIceCandidates([]);
      setCallConversationId(null);
    });

    const activeTimers = typingTimerMapRef.current;
    return () => {
      channel.unbind_all();
      pusherClient.unsubscribe(channelName);
      activeTimers.forEach((t) => clearTimeout(t));
      activeTimers.clear();
    };
  }, [pusherClient, selectedConversationId, currentUser.id, markAsSeen, refreshConversations, toast]);

  // 5. User private channel subscription (incoming messages across all chats & new conversations)
  useEffect(() => {
    if (!pusherClient || !currentUser.id) return;

    const userChannel = pusherClient.subscribe(`private-user-${currentUser.id}`);

    userChannel.bind(REALTIME_EVENTS.CONVERSATION_CREATED, () => {
      refreshConversations();
    });

    userChannel.bind(
      REALTIME_EVENTS.CONVERSATION_DELETED,
      (data: { conversationId: string }) => {
        setConversations((prev) => prev.filter((c) => c.id !== data.conversationId));
        if (selectedConversationIdRef.current === data.conversationId) {
          setSelectedConversationId(null);
          setMessages([]);
          setMobileView("list");
        }
      }
    );

    userChannel.bind(
      REALTIME_EVENTS.CONVERSATION_UPDATED,
      (data: { conversationId: string; lastMessage?: MessageWithDetails }) => {
        // If from another user and NOT in the currently active conversation, play subtle chime (skip call logs)
        if (
          data.lastMessage &&
          data.lastMessage.senderId !== currentUser.id &&
          data.conversationId !== selectedConversationIdRef.current &&
          !data.lastMessage.content?.startsWith("CALL:")
        ) {
          playReceiveSound();
        }

        setConversations((prev) => {
          const index = prev.findIndex((c) => c.id === data.conversationId);
          if (index === -1) {
            refreshConversations();
            return prev;
          }
          const target = prev[index];
          const isCurrentActive = target.id === selectedConversationIdRef.current;
          const updatedConv: ConversationWithDetails = {
            ...target,
            lastMessage: data.lastMessage || target.lastMessage,
            updatedAt: new Date(),
            unreadCount: isCurrentActive ? 0 : (target.unreadCount || 0) + 1,
          };

          const remaining = prev.filter((c) => c.id !== data.conversationId);
          return [updatedConv, ...remaining];
        });
      }
    );

    userChannel.bind(REALTIME_EVENTS.TYPING, (payload: TypingEventPayload) => {
      if (payload.userId === currentUser.id) return;
      const convId = payload.conversationId;
      const userName = payload.userName || "Someone";
      if (!convId) return;

      if (payload.isTyping) {
        setActiveTypingMap((prev) => ({
          ...prev,
          [convId]: Array.from(new Set([...(prev[convId] || []), userName])),
        }));
      } else {
        setActiveTypingMap((prev) => ({
          ...prev,
          [convId]: (prev[convId] || []).filter((name) => name !== userName),
        }));
      }
    });

    // WebRTC: Incoming Call Offer
    userChannel.bind(REALTIME_EVENTS.CALL_OFFER, (data: CallOfferPayload) => {
      if (data.calleeId && data.calleeId !== currentUser.id) return;

      if (callStatusRef.current !== "idle") {
        fetch(`/api/conversations/${data.conversationId}/call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reject",
            targetUserId: data.caller.id,
            reason: "User is busy on another call",
          }),
        }).catch(() => {});
        return;
      }

      setCallConversationId(data.conversationId);
      setCallingTarget({
        id: data.caller.id,
        name: data.caller.name,
        avatar: data.caller.avatar,
      });
      setActiveCallType((data.callType as "AUDIO" | "VIDEO") || "VIDEO");
      setIncomingOfferSdp(data.sdp);
      setCallStatus("incoming");
    });

    // WebRTC: Call Answer received by caller
    userChannel.bind(REALTIME_EVENTS.CALL_ANSWER, (data: CallAnswerPayload) => {
      if (data.calleeId !== currentUser.id) {
        stopAllRingtones();
        setRemoteAnswerSdp(data.sdp);
        setCallStatus("connected");
      }
    });

    // WebRTC: Remote ICE Candidate
    userChannel.bind(REALTIME_EVENTS.CALL_ICE_CANDIDATE, (data: CallIceCandidatePayload) => {
      if (data.senderId && data.senderId === currentUser.id) return;
      if (data.candidate) {
        setPendingIceCandidates((prev) => [...prev, data.candidate]);
      }
    });

    // WebRTC: Call Rejected
    userChannel.bind(REALTIME_EVENTS.CALL_REJECT, (data: CallRejectPayload) => {
      stopAllRingtones();
      toast.error(data.reason || "The call was declined.", "Call Declined");
      setCallStatus("idle");
      setCallingTarget(null);
      setIncomingOfferSdp(null);
      setRemoteAnswerSdp(null);
      setPendingIceCandidates([]);
      setCallConversationId(null);
    });

    // WebRTC: Call Ended by remote peer
    userChannel.bind(REALTIME_EVENTS.CALL_END, () => {
      stopAllRingtones();
      toast.info("Call ended by remote user.", "Call Ended");
      setCallStatus("idle");
      setCallingTarget(null);
      setIncomingOfferSdp(null);
      setRemoteAnswerSdp(null);
      setPendingIceCandidates([]);
      setCallConversationId(null);
    });

    return () => {
      userChannel.unbind_all();
      pusherClient.unsubscribe(`private-user-${currentUser.id}`);
    };
  }, [pusherClient, currentUser.id, refreshConversations, toast]);

  // 5.5 Silent background sync for active conversation messages
  useEffect(() => {
    if (!selectedConversationId) return;

    const syncInterval = setInterval(async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch(`/api/conversations/${selectedConversationId}/messages?limit=25`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.messages && Array.isArray(data.messages)) {
          setMessages((prev) => {
            const map = new Map<string, MessageWithDetails>();
            prev.forEach((m) => {
              if (!m.isOptimistic) map.set(m.id, m);
            });
            data.messages.forEach((m: MessageWithDetails) => map.set(m.id, m));
            const optimistic = prev.filter((m) => m.isOptimistic);
            const combined = Array.from(map.values()).sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            return [...combined, ...optimistic];
          });
        }
      } catch {
        // silent
      }
    }, 3000);

    return () => clearInterval(syncInterval);
  }, [selectedConversationId]);

  // 6. Send message with optimistic update
  const handleSendMessage = async (payload: {
    content?: string;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
    attachmentSize?: number | null;
    attachmentType?: string | null;
    type?: "TEXT" | "IMAGE" | "FILE";
    replyToId?: string | null;
  }) => {
    if (!selectedConversationId) return;

    // Optimistic Message item
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: MessageWithDetails = {
      id: tempId,
      conversationId: selectedConversationId,
      senderId: currentUser.id,
      content: payload.content || null,
      type: payload.type || "TEXT",
      attachmentUrl: payload.attachmentUrl,
      attachmentName: payload.attachmentName,
      attachmentSize: payload.attachmentSize,
      attachmentType: payload.attachmentType,
      replyToId: payload.replyToId,
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            content: replyingTo.content,
            senderId: replyingTo.senderId,
            sender: { name: replyingTo.sender?.name || "User" },
          }
        : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sender: currentUser,
      reactions: [],
      readReceipts: [],
      isOptimistic: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setReplyingTo(null);

    try {
      const res = await fetch(`/api/conversations/${selectedConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      // Replace optimistic message with confirmed server message
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? data.message : m))
      );

      // Update last message in sidebar and bring to top
      setConversations((prev) => {
        const target = prev.find((c) => c.id === selectedConversationId);
        if (!target) return prev;
        const updated = { ...target, lastMessage: data.message, updatedAt: new Date() };
        const others = prev.filter((c) => c.id !== selectedConversationId);
        return [updated, ...others];
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error sending message";
      toast.error(msg, "Error");
      // Remove failed optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  // 7. Save edit
  const handleSaveEdit = async (messageId: string, newContent: string) => {
    if (!selectedConversationId) return;

    try {
      const res = await fetch(
        `/api/conversations/${selectedConversationId}/messages/${messageId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: newContent }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to edit message");
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? data.message : m))
      );
      setEditingMessage(null);
      toast.success("Message edited.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error editing message";
      toast.error(msg, "Error");
    }
  };

  // 8. Delete message
  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedConversationId) return;

    try {
      const res = await fetch(
        `/api/conversations/${selectedConversationId}/messages/${messageId}`,
        { method: "DELETE" }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete message");
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? data.message : m))
      );
      toast.success("Message deleted.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error deleting message";
      toast.error(msg, "Error");
    }
  };

  // 9. React to message
  const handleReaction = async (messageId: string, emoji: string) => {
    if (!selectedConversationId) return;

    try {
      const res = await fetch(
        `/api/conversations/${selectedConversationId}/messages/${messageId}/reactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reaction: emoji }),
        }
      );

      const data = await res.json();
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions: data.reactions } : m))
        );
      }
    } catch {
      // ignore reaction network error
    }
  };

  // Export conversation history as a text file
  const handleExportChat = () => {
    if (!activeConversation || messages.length === 0) {
      toast.info("No messages to export.", "Export");
      return;
    }

    const lines = messages.map((m) => {
      const sender = m.sender?.name || "User";
      const time = new Date(m.createdAt).toLocaleString();
      const content =
        m.content ||
        (m.attachmentUrl ? `[Attachment: ${m.attachmentName || "File"}]` : "");
      return `[${time}] ${sender}: ${content}`;
    });

    const title =
      activeConversation.type === "GROUP"
        ? activeConversation.name || "Group Chat"
        : "Direct Chat";

    const fileContent = `=== Conversation History: ${title} ===\nExported: ${new Date().toLocaleString()}\nTotal Messages: ${messages.length}\n\n${lines.join("\n")}`;

    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-history-${activeConversation.id.slice(-6)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Chat history exported.");
  };

  // Keyboard shortcut Ctrl+K / Cmd+K for in-chat search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchingInChat((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const confirmDeleteConversation = async () => {
    if (!conversationToDelete) return;
    setIsDeletingConversation(true);
    try {
      const res = await fetch(`/api/conversations/${conversationToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete conversation");
      }

      setConversations((prev) => prev.filter((c) => c.id !== conversationToDelete.id));
      if (selectedConversationId === conversationToDelete.id) {
        setSelectedConversationId(null);
        setMessages([]);
        setMobileView("list");
      }
      toast.success("Conversation deleted successfully.");
      setConversationToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete conversation";
      toast.error(msg, "Error");
    } finally {
      setIsDeletingConversation(false);
    }
  };

  // Select conversation and toggle mobile view
  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
    setMobileView("chat");
  };

  const handleConversationCreated = async (id: string) => {
    await refreshConversations();
    setSelectedConversationId(id);
    setMobileView("chat");
  };

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Sidebar: Full on desktop; toggled on mobile */}
      <div
        className={`w-full md:w-auto h-full ${
          mobileView === "chat" ? "hidden md:flex" : "flex"
        }`}
      >
        <ConversationSidebar
          currentUser={currentUser}
          conversations={conversations}
          selectedConversationId={selectedConversationId}
          activeTypingMap={activeTypingMap}
          onSelectConversation={handleSelectConversation}
          onOpenNewChat={() => setIsNewChatOpen(true)}
          onOpenNewGroup={() => setIsNewGroupOpen(true)}
          onOpenProfile={() => setIsProfileOpen(true)}
          onDeleteConversation={(convId) => {
            const target = conversations.find((c) => c.id === convId);
            if (target) setConversationToDelete(target);
          }}
          isUserOnline={isUserOnline}
        />
      </div>

      {/* Main Conversation Window */}
      <div
        className={`flex-1 flex flex-col h-full overflow-hidden bg-slate-900/40 relative ${
          mobileView === "list" ? "hidden md:flex" : "flex"
        }`}
      >
        {activeConversation ? (
          <>
            <ChatHeader
              conversation={activeConversation}
              currentUserId={currentUser.id}
              isOnline={
                activeConversation.type === "DIRECT"
                  ? isUserOnline(
                      activeConversation.members.find((m) => m.userId !== currentUser.id)
                        ?.userId || ""
                    )
                  : false
              }
              typingUsers={typingUsers}
              onBack={() => setMobileView("list")}
              onOpenDetails={() => setIsGroupDetailsOpen(true)}
              onToggleSearch={() => setIsSearchingInChat(!isSearchingInChat)}
              onExportChat={handleExportChat}
              onStartCall={handleStartCall}
              onDeleteConversation={() => setConversationToDelete(activeConversation)}
              isSearching={isSearchingInChat}
            />

            {isSearchingInChat && (
              <ConversationSearch
                conversationId={activeConversation.id}
                onClose={() => setIsSearchingInChat(false)}
              />
            )}

            <MessageList
              messages={messages}
              currentUserId={currentUser.id}
              isGroup={activeConversation.type === "GROUP"}
              isLoading={isLoadingMessages}
              hasMore={Boolean(cursor)}
              isLoadingMore={isLoadingMore}
              typingUsers={typingUsers}
              onLoadMore={handleLoadMore}
              onReply={(msg) => setReplyingTo(msg)}
              onEdit={(msg) => setEditingMessage(msg)}
              onDelete={handleDeleteMessage}
              onReact={handleReaction}
              onStartCall={handleStartCall}
            />

            <MessageInput
              conversationId={activeConversation.id}
              onSendMessage={handleSendMessage}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
              editingMessage={editingMessage}
              onCancelEdit={() => setEditingMessage(null)}
              onSaveEdit={handleSaveEdit}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 mb-4 shadow-xl">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-200">No Conversation Selected</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
              Select a conversation from the sidebar or start a new chat with another team member.
            </p>
            <button
              onClick={() => setIsNewChatOpen(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition active:scale-95"
            >
              Start New Chat
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onConversationCreated={handleConversationCreated}
        isUserOnline={isUserOnline}
      />

      <NewGroupModal
        isOpen={isNewGroupOpen}
        onClose={() => setIsNewGroupOpen(false)}
        onGroupCreated={handleConversationCreated}
        isUserOnline={isUserOnline}
      />

      {activeConversation && (
        <GroupDetailsModal
          isOpen={isGroupDetailsOpen}
          onClose={() => setIsGroupDetailsOpen(false)}
          conversation={activeConversation}
          currentUserId={currentUser.id}
          isUserOnline={isUserOnline}
          onGroupUpdated={refreshConversations}
          onLeaveGroup={() => {
            refreshConversations();
            setSelectedConversationId(null);
            setMobileView("list");
          }}
          onDeleteConversation={() => setConversationToDelete(activeConversation)}
        />
      )}

      {/* Delete Conversation Confirmation Modal */}
      <Modal
        isOpen={Boolean(conversationToDelete)}
        onClose={() => {
          if (!isDeletingConversation) setConversationToDelete(null);
        }}
        title={`Delete ${conversationToDelete?.type === "GROUP" ? "Group" : "Conversation"}`}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-rose-200">
                Are you sure you want to delete{" "}
                <span className="font-bold text-white">
                  &ldquo;
                  {conversationToDelete?.type === "GROUP"
                    ? conversationToDelete.name || "Group Chat"
                    : conversationToDelete?.members.find((m) => m.userId !== currentUser.id)?.user?.name || "Direct Chat"}
                  &rdquo;
                </span>
                ?
              </p>
              <p className="text-rose-300/80">
                This will permanently delete the conversation, all messages, call logs, and attachments for all participants. This action cannot be undone.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isDeletingConversation}
              onClick={() => setConversationToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isDeletingConversation}
              onClick={confirmDeleteConversation}
            >
              {isDeletingConversation ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  <span>Delete</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentUser={currentUser}
        onProfileUpdated={(updated) => setCurrentUser(updated)}
      />

      {callStatus !== "idle" && callingTarget && (
        <CallModal
          conversationId={callConversationId || selectedConversationId || ""}
          currentUserId={currentUser.id}
          otherUser={callingTarget}
          callType={activeCallType}
          callStatus={callStatus}
          isOtherUserOnline={isUserOnline(callingTarget.id)}
          incomingOfferSdp={incomingOfferSdp}
          onAcceptIncoming={handleAcceptIncoming}
          onRejectIncoming={handleRejectIncoming}
          onEndCall={handleEndCall}
          onSendSignal={handleSendCallSignal}
          remoteAnswerSdp={remoteAnswerSdp}
          pendingIceCandidates={pendingIceCandidates}
        />
      )}
    </div>
  );
}
