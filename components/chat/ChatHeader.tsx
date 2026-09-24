"use client";

import React from "react";
import { ConversationWithDetails, UserSummary } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { formatLastSeen } from "@/lib/utils";
import { ArrowLeft, Users, Search, Info } from "lucide-react";

interface ChatHeaderProps {
  conversation: ConversationWithDetails;
  currentUserId: string;
  isOnline: boolean;
  onBack?: () => void;
  onOpenDetails: () => void;
  onToggleSearch: () => void;
  isSearching: boolean;
}

export function ChatHeader({
  conversation,
  currentUserId,
  isOnline,
  onBack,
  onOpenDetails,
  onToggleSearch,
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

  const statusText = isGroup
    ? `${conversation.members.length} members`
    : isOnline
    ? "Active now"
    : formatLastSeen(otherUser?.lastSeen);

  return (
    <div className="h-16 px-4 border-b border-slate-800/80 bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-3 z-10">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile Back Button */}
        {onBack && (
          <button
            onClick={onBack}
            className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="w-5 h-5" />
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
        <div
          className="min-w-0 cursor-pointer flex-1"
          onClick={onOpenDetails}
        >
          <h2 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
            {displayName}
            {isGroup && <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
          </h2>
          <p className="text-xs text-slate-400 truncate flex items-center gap-1">
            {!isGroup && isOnline && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
            )}
            {statusText}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1">
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
