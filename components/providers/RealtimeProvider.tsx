"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { getPusherClient } from "@/lib/realtime/client";
import { REALTIME_EVENTS, ClientRealtimeInstance } from "@/lib/realtime/types";
import { useToast } from "./ToastProvider";

interface RealtimeContextType {
  pusherClient: ClientRealtimeInstance | null;
  onlineUserIds: Set<string>;
  isUserOnline: (userId: string) => boolean;
}

const RealtimeContext = createContext<RealtimeContextType>({
  pusherClient: null,
  onlineUserIds: new Set(),
  isUserOnline: () => false,
});

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [pusherClient, setPusherClient] = useState<ClientRealtimeInstance | null>(null);
  const { toast } = useToast();

  // 1. Request browser notification permission once on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  // 2. Active Presence heartbeat & online polling
  useEffect(() => {
    if (!currentUserId) return;

    // Immediately mark self as online
    setOnlineUserIds((prev) => new Set([...prev, currentUserId]));

    const sendHeartbeat = async () => {
      try {
        const res = await fetch("/api/presence", { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          if (data.onlineUserIds && Array.isArray(data.onlineUserIds)) {
            setOnlineUserIds(new Set([...data.onlineUserIds, currentUserId]));
          }
        }
      } catch {
        // network issue, keep current set
      }
    };

    // Initial heartbeat
    sendHeartbeat();

    // Periodic heartbeat every 20 seconds
    const interval = setInterval(sendHeartbeat, 20000);

    // Heartbeat on tab focus
    const handleFocus = () => sendHeartbeat();
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [currentUserId]);

  // 3. Connect Realtime Channels
  useEffect(() => {
    if (!currentUserId) return;

    const client = getPusherClient();
    if (!client) return;

    setPusherClient(client);

    // Subscribe to presence channel
    const presenceChannel = client.subscribe("presence-online");

    presenceChannel.bind(
      "pusher:subscription_succeeded",
      (membersData: { members?: Record<string, unknown> }) => {
        const members = membersData?.members || {};
        const activeIds = new Set<string>([
          ...Object.keys(members),
          currentUserId,
        ]);
        setOnlineUserIds(activeIds);
      }
    );

    presenceChannel.bind("pusher:member_added", (member: { id: string }) => {
      if (member?.id) {
        setOnlineUserIds((prev) => new Set([...prev, member.id]));
      }
    });

    presenceChannel.bind("pusher:member_removed", (member: { id: string }) => {
      if (member?.id && member.id !== currentUserId) {
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          next.delete(member.id);
          return next;
        });
      }
    });

    // Subscribe to user private channel
    const userChannel = client.subscribe(`private-user-${currentUserId}`);

    userChannel.bind(
      REALTIME_EVENTS.CONVERSATION_CREATED,
      (data: { conversation: { name?: string; type: string } }) => {
        const title =
          data.conversation.type === "GROUP"
            ? data.conversation.name
            : "New Conversation";
        toast.info("You were added to a new conversation.", title);
      }
    );

    userChannel.bind(
      REALTIME_EVENTS.CONVERSATION_UPDATED,
      (data: { lastMessage?: { sender?: { name: string }; content?: string } }) => {
        if (data.lastMessage) {
          const senderName = data.lastMessage.sender?.name || "Someone";
          const snippet = data.lastMessage.content || "Sent an attachment";

          if (
            typeof window !== "undefined" &&
            document.hidden &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            try {
              new Notification(`New message from ${senderName}`, {
                body: snippet,
                icon: "/favicon.ico",
              });
            } catch {
              // ignore notification creation error
            }
          }
        }
      }
    );

    return () => {
      presenceChannel.unbind_all();
      userChannel.unbind_all();
      client.unsubscribe("presence-online");
      client.unsubscribe(`private-user-${currentUserId}`);
    };
  }, [currentUserId, toast]);

  const isUserOnline = useCallback(
    (targetUserId: string) => {
      if (!targetUserId) return false;
      if (currentUserId && targetUserId === currentUserId) return true;
      return onlineUserIds.has(targetUserId);
    },
    [currentUserId, onlineUserIds]
  );

  return (
    <RealtimeContext.Provider value={{ pusherClient, onlineUserIds, isUserOnline }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtimeContext() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error("useRealtimeContext must be used within RealtimeProvider");
  }
  return context;
}
