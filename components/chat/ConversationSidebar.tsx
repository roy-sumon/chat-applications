"use client";

import React, { useState } from "react";
import { signOut } from "next-auth/react";
import { ConversationWithDetails, UserSummary } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { formatConversationDate, cn } from "@/lib/utils";
import { isSoundEnabled, setSoundEnabled } from "@/lib/utils/sound";
import {
  MessageSquarePlus,
  Users,
  Search,
  LogOut,
  Settings,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

interface ConversationSidebarProps {
  currentUser: UserSummary;
  conversations: ConversationWithDetails[];
  selectedConversationId: string | null;
  activeTypingMap?: Record<string, string[]>;
  onSelectConversation: (conversationId: string) => void;
  onOpenNewChat: () => void;
  onOpenNewGroup: () => void;
  onOpenProfile: () => void;
  isUserOnline: (userId: string) => boolean;
}

export function ConversationSidebar({
  currentUser,
  conversations,
  selectedConversationId,
  activeTypingMap = {},
  onSelectConversation,
  onOpenNewChat,
  onOpenNewGroup,
  onOpenProfile,
  isUserOnline,
}: ConversationSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    if (c.type === "GROUP") {
      return c.name?.toLowerCase().includes(q);
    }
    const otherMember = c.members.find((m) => m.userId !== currentUser.id);
    return (
      otherMember?.user.name.toLowerCase().includes(q) ||
      otherMember?.user.email.toLowerCase().includes(q)
    );
  });

  return (
    <aside className="w-full md:w-80 lg:w-96 h-full flex flex-col bg-slate-950 border-r border-slate-800/80 shrink-0 select-none">
      {/* Current User Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between gap-3 bg-slate-900/60">
        <div
          className="flex items-center gap-3 min-w-0 cursor-pointer hover:opacity-90 transition"
          onClick={onOpenProfile}
          title="Edit Profile"
        >
          <Avatar
            src={currentUser.avatar}
            name={currentUser.name}
            size="md"
            isOnline={true}
            showOnlineStatus={true}
          />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{currentUser.name}</h3>
            <p className="text-xs text-slate-400 truncate">{currentUser.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleSound}
            title={soundOn ? "Mute notification sounds" : "Unmute notification sounds"}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
          >
            {soundOn ? (
              <Volume2 className="w-4 h-4 text-indigo-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>
          <button
            onClick={onOpenProfile}
            title="Profile settings"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Action Toolbar & Search */}
      <div className="p-3 space-y-2 border-b border-slate-800/60 bg-slate-900/30">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full h-9 pl-9 pr-8 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Buttons Row */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onOpenNewChat}
            className="flex items-center justify-center gap-2 h-9 px-3 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 text-xs font-semibold transition active:scale-98"
          >
            <MessageSquarePlus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
          <button
            onClick={onOpenNewGroup}
            className="flex items-center justify-center gap-2 h-9 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 text-xs font-semibold transition active:scale-98"
          >
            <Users className="w-4 h-4" />
            <span>New Group</span>
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-900/50 p-2 space-y-1">
        {filteredConversations.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-xs">
            {searchQuery ? "No conversations match your search." : "No chats yet. Start a conversation above!"}
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isGroup = conv.type === "GROUP";
            const otherMember = conv.members.find((m) => m.userId !== currentUser.id);
            const otherUser = otherMember?.user;

            const title = isGroup ? conv.name || "Group Chat" : otherUser?.name || "Direct Message";
            const avatarSrc = isGroup ? conv.avatar : otherUser?.avatar;
            const online = !isGroup && otherUser ? isUserOnline(otherUser.id) : false;

            const isSelected = selectedConversationId === conv.id;
            const unread = conv.unreadCount || 0;

            const typingList = activeTypingMap[conv.id] || [];
            const isTyping = typingList.length > 0;

            // Last message snippet
            let snippet = "No messages yet";
            if (conv.lastMessage) {
              const lastContent = conv.lastMessage.content || "";
              if (lastContent.startsWith("CALL:")) {
                const parts = lastContent.split(":");
                const callStatus = parts[1] || "MISSED";
                const isVideo = parts[2] === "VIDEO";
                const isCallSelf = conv.lastMessage.senderId === currentUser.id;
                const dur = Number(parts[3]) || 0;

                if (callStatus === "MISSED") {
                  snippet = isCallSelf
                    ? `${isVideo ? "📹 Outgoing video" : "📞 Outgoing voice"} call (No answer)`
                    : `🔴 Missed ${isVideo ? "video" : "voice"} call`;
                } else if (callStatus === "DECLINED") {
                  snippet = `${isVideo ? "📹 Video" : "📞 Voice"} call declined`;
                } else if (callStatus === "ENDED") {
                  const m = Math.floor(dur / 60);
                  const s = dur % 60;
                  const durFormatted = m > 0 ? `${m}m ${s}s` : `${s}s`;
                  snippet = `${isVideo ? "📹 Video" : "📞 Voice"} call (${durFormatted})`;
                } else {
                  snippet = isVideo ? "📹 Video call" : "📞 Voice call";
                }
              } else {
                const prefix =
                  conv.lastMessage.senderId === currentUser.id
                    ? "You: "
                    : isGroup
                    ? `${conv.lastMessage.sender?.name?.split(" ")[0] || "User"}: `
                    : "";
                const body =
                  lastContent ||
                  (conv.lastMessage.type === "IMAGE" ? "📷 Photo" : "📎 Attachment");
                snippet = `${prefix}${body}`;
              }
            }

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-150 group active:scale-[0.98]",
                  isSelected
                    ? "bg-indigo-600/15 border border-indigo-500/30 text-white"
                    : "hover:bg-slate-900/80 text-slate-300 border border-transparent"
                )}
              >
                <Avatar
                  src={avatarSrc}
                  name={title}
                  size="md"
                  isOnline={online}
                  showOnlineStatus={!isGroup}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <h4
                      className={cn(
                        "text-xs font-semibold truncate",
                        isSelected ? "text-indigo-200" : "text-slate-100 group-hover:text-white"
                      )}
                    >
                      {title}
                    </h4>
                    {conv.lastMessage && (
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {formatConversationDate(conv.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    {isTyping ? (
                      <p className="text-xs text-emerald-400 font-medium truncate flex items-center gap-1 animate-pulse">
                        <span className="flex gap-0.5 items-center">
                          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce" />
                          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.15s]" />
                          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.3s]" />
                        </span>
                        <span>{typingList.join(", ")} typing...</span>
                      </p>
                    ) : (
                      <p
                        className={cn(
                          "text-xs truncate",
                          unread > 0 ? "font-semibold text-slate-200" : "text-slate-400"
                        )}
                      >
                        {snippet}
                      </p>
                    )}

                    {unread > 0 && (
                      <Badge variant="primary" size="sm" className="bg-indigo-600 text-white border-none shrink-0 font-bold">
                        {unread > 99 ? "99+" : unread}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
