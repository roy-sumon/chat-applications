"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { UserSummary } from "@/types";
import { Search, Loader2, MessageSquare } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationCreated: (conversationId: string) => void;
  isUserOnline: (userId: string) => boolean;
}

export function NewChatModal({
  isOpen,
  onClose,
  onConversationCreated,
  isUserOnline,
}: NewChatModalProps) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setUsers([]);
      return;
    }

    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/users?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        if (res.ok) {
          setUsers(data.users || []);
        }
      } catch (err) {
        console.error("Failed to fetch users:", err);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchUsers, 250);
    return () => clearTimeout(timer);
  }, [isOpen, query]);

  const handleSelectUser = async (userId: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: userId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start conversation");
      }

      toast.success("Conversation opened.");
      onConversationCreated(data.conversation.id);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error starting conversation";
      toast.error(msg, "Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Direct Conversation"
      description="Search and connect with other team members"
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full h-10 pl-10 pr-4 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
        </div>

        {/* User list */}
        <div className="max-h-72 overflow-y-auto space-y-1 divide-y divide-slate-800/40 pr-1">
          {isLoading ? (
            <div className="py-8 flex flex-col items-center justify-center text-slate-500 text-xs">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500 mb-2" />
              <span>Finding users...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              {query ? "No users found matching your search." : "No other users registered yet."}
            </div>
          ) : (
            users.map((u) => {
              const online = isUserOnline(u.id);
              return (
                <div
                  key={u.id}
                  onClick={() => handleSelectUser(u.id)}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-800 cursor-pointer transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      src={u.avatar}
                      name={u.name}
                      size="sm"
                      isOnline={online}
                      showOnlineStatus={true}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                        {u.name}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                    </div>
                  </div>

                  <button
                    disabled={isSubmitting}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
