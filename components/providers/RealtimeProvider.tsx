"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { getPusherClient } from "@/lib/realtime/client";
import { REALTIME_EVENTS } from "@/lib/realtime/types";
import { useToast } from "./ToastProvider";
import type PusherClient from "pusher-js";
import type { PresenceChannel } from "pusher-js";

interface RealtimeContextType {
  pusherClient: PusherClient | null;
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
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [pusherClient, setPusherClient] = useState<PusherClient | null>(null);
  const { toast } = useToast();

  // Request browser notification permission once on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    setPusherClient(pusher);

    // 1. Subscribe to online presence channel
    const presenceChannel = pusher.subscribe("presence-online") as PresenceChannel;

    presenceChannel.bind("pusher:subscription_succeeded", (members: { members: Record<string, unknown> }) => {
      const activeIds = new Set(Object.keys(members.members));
      setOnlineUserIds(activeIds);
    });

    presenceChannel.bind("pusher:member_added", (member: { id: string }) => {
      setOnlineUserIds((prev) => new Set([...prev, member.id]));
    });

    presenceChannel.bind("pusher:member_removed", (member: { id: string }) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        next.delete(member.id);
        return next;
      });
    });

    // 2. Subscribe to user's private channel for incoming conversations and alerts
    const userChannel = pusher.subscribe(`private-user-${userId}`);

    userChannel.bind(REALTIME_EVENTS.CONVERSATION_CREATED, (data: { conversation: { name?: string; type: string } }) => {
      const title = data.conversation.type === "GROUP" ? data.conversation.name : "New Conversation";
      toast.info("You were added to a new conversation.", title);
    });

    userChannel.bind(
      REALTIME_EVENTS.CONVERSATION_UPDATED,
      (data: { lastMessage?: { sender?: { name: string }; content?: string } }) => {
        if (data.lastMessage) {
          const senderName = data.lastMessage.sender?.name || "Someone";
          const snippet = data.lastMessage.content || "Sent an attachment";

          // If document is not focused, trigger browser notification if allowed
          if (typeof window !== "undefined" && document.hidden && "Notification" in window && Notification.permission === "granted") {
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
      pusher.unsubscribe("presence-online");
      pusher.unsubscribe(`private-user-${userId}`);
    };
  }, [session?.user?.id, toast]);

  const isUserOnline = useCallback(
    (targetUserId: string) => {
      return onlineUserIds.has(targetUserId);
    },
    [onlineUserIds]
  );

  return (
    <RealtimeContext.Provider value={{ pusherClient, onlineUserIds, isUserOnline }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtimeContext() {
  return useContext(RealtimeContext);
}
