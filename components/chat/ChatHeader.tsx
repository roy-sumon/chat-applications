"use client";

import React from "react";
import { ConversationWithDetails, UserSummary } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { formatLastSeen } from "@/lib/utils";
import { ArrowLeft, Users, Search, Info, Download, Phone, Video } from "lucide-react";

interface ChatHeaderProps {
  conversation: ConversationWithDetails;
  currentUserId: string;
  isOnline: boolean;
  typingUsers?: string[];
  onBack?: () => void;
  onOpenDetails: () => void;
  onToggleSearch: () => void;
  onExportChat?: () => void;
  onStartCall?: (type: "AUDIO" | "VIDEO") => void;
  isSearching: boolean;
}

export function ChatHeader({
  conversation,
  currentUserId,
  isOnline,
  typingUsers = [],
  onBack,
  onOpenDetails,
  onToggleSearch,
  onExportChat,
  onStartCall,
  isSearching,
}: ChatHeaderProps) {
  const isGroup = conversation.type === "GROUP";

  // If direct conversation, get the other user's info
  const otherMember = conversation.members.find((m) => m.userId !== currentUserId);
  const otherUser: UserSummary | undefined = otherMember?.user;

  const displayName = isGroup
    ? conversation.name || "Group Chat"
    : otherUser?.name || "Direct Message";

  const displayAvatar = isGroup ? conversation.avatar : otherUser?.avatar;

  const isTyping = typingUsers.length > 0;
  const typingLabel = `${typingUsers.join(", ")} ${typingUsers.length > 1 ? "are" : "is"} typing...`;

  return (
    <div className="h-16 px-4 border-b border-slate-800/80 bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-3 z-10 select-none">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile Back Button */}
        {onBack && (
          <button
            onClick={onBack}
            className="md:hidden flex items-center gap-1 p-2 -ml-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition active:scale-95 shrink-0"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="w-5 h-5 text-indigo-400" />
            <span className="text-xs font-semibold text-slate-300">Chats</span>
          </button>
        )}

        {/* Avatar */}
        <div className="cursor-pointer" onClick={onOpenDetails}>
          <Avatar
            src={displayAvatar}
            name={displayName}
            size="md"
            isOnline={isOnline}
            showOnlineStatus={!isGroup}
          />
        </div>

        {/* Title and Status */}
        <div className="min-w-0 cursor-pointer flex-1" onClick={onOpenDetails}>
          <h2 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
            {displayName}
            {isGroup && <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
          </h2>
          <div className="text-xs text-slate-400 truncate flex items-center gap-1">
            {isTyping ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1.5 animate-pulse">
                <span className="flex gap-0.5 items-center">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce" />
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.15s]" />
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.3s]" />
                </span>
                <span>{typingLabel}</span>
              </span>
            ) : isGroup ? (
              <span>{conversation.members.length} members</span>
            ) : isOnline ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                Active now
              </span>
            ) : (
              <span>{formatLastSeen(otherUser?.lastSeen)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1">
        {onStartCall && !isGroup && (
          <>
            <button
              onClick={() => onStartCall("AUDIO")}
              title="Start voice call"
              className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-xl transition"
            >
              <Phone className="w-4 h-4" />
            </button>
            <button
              onClick={() => onStartCall("VIDEO")}
              title="Start video call"
              className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-xl transition"
            >
              <Video className="w-4 h-4" />
            </button>
          </>
        )}

        {onExportChat && (
          <button
            onClick={onExportChat}
            title="Export conversation (.txt)"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition hidden sm:inline-flex"
          >
            <Download className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onToggleSearch}
          title="Search in conversation"
          className={`p-2 rounded-xl transition ${
            isSearching
              ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenDetails}
          title="Conversation details"
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
