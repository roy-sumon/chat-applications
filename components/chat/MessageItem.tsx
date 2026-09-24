"use client";

import React, { useState } from "react";
import Image from "next/image";
import { MessageWithDetails } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { formatMessageTime, formatFileSize, cn } from "@/lib/utils";
import {
  Check,
  CheckCheck,
  Clock,
  Reply,
  Copy,
  Pencil,
  Trash2,
  FileText,
  Download,
  Smile,
} from "lucide-react";

interface MessageItemProps {
  message: MessageWithDetails;
  currentUserId: string;
  isGroup?: boolean;
  onReply: (message: MessageWithDetails) => void;
  onEdit: (message: MessageWithDetails) => void;
  onDelete: (messageId: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onImageClick?: (url: string) => void;
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "😮", "🎉"];

export function MessageItem({
  message,
  currentUserId,
  isGroup = false,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onImageClick,
}: MessageItemProps) {
  const [showActions, setShowActions] = useState(false);
  const [showReactionMenu, setShowReactionMenu] = useState(false);

  const isSelf = message.senderId === currentUserId;
  const isDeleted = Boolean(message.deletedAt);
  const isSystem = message.type === "SYSTEM";

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <span className="px-3 py-1 text-xs text-slate-400 bg-slate-900/60 border border-slate-800 rounded-full select-none">
          {message.content}
        </span>
      </div>
    );
  }

  // Aggregate reactions by emoji
  const reactionCounts: Record<string, { count: number; userReacted: boolean }> = {};
  message.reactions?.forEach((r) => {
    if (!reactionCounts[r.reaction]) {
      reactionCounts[r.reaction] = { count: 0, userReacted: false };
    }
    reactionCounts[r.reaction].count += 1;
    if (r.userId === currentUserId) {
      reactionCounts[r.reaction].userReacted = true;
    }
  });

  const isSeen = message.readReceipts && message.readReceipts.length > 0;

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
    }
  };

  return (
    <div
      className={cn(
        "group relative flex gap-2.5 my-1.5 transition-colors px-2 py-0.5 rounded-xl",
        isSelf ? "justify-end" : "justify-start"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowReactionMenu(false);
      }}
    >
      {/* Left Avatar for received messages */}
      {!isSelf && (
        <Avatar
          src={message.sender?.avatar}
          name={message.sender?.name}
          size="sm"
          className="mt-1 shrink-0"
        />
      )}

      {/* Floating Action Bar */}
      {showActions && !isDeleted && (
        <div
          className={cn(
            "absolute -top-3 z-20 flex items-center gap-0.5 p-1 rounded-xl bg-slate-900 border border-slate-700/80 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95",
            isSelf ? "right-12" : "left-12"
          )}
        >
          {/* Reaction Quick Bar trigger */}
          <div className="relative">
            <button
              onClick={() => setShowReactionMenu(!showReactionMenu)}
              title="React"
              className="p-1 hover:bg-slate-800 text-slate-300 hover:text-amber-400 rounded-lg transition"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
            {showReactionMenu && (
              <div className="absolute bottom-8 left-0 flex items-center gap-1 p-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onReact(message.id, emoji);
                      setShowReactionMenu(false);
                    }}
                    className="hover:scale-125 transition-transform text-base p-1"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => onReply(message)}
            title="Reply"
            className="p-1 hover:bg-slate-800 text-slate-300 hover:text-indigo-400 rounded-lg transition"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>

          {message.content && (
            <button
              onClick={handleCopy}
              title="Copy text"
              className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}

          {isSelf && (
            <>
              <button
                onClick={() => onEdit(message)}
                title="Edit message"
                className="p-1 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg transition"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete(message.id)}
                title="Delete message"
                className="p-1 hover:bg-slate-800 text-slate-300 hover:text-rose-400 rounded-lg transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Message Content Bubble Container */}
      <div className={cn("flex flex-col max-w-[80%] sm:max-w-[70%]", isSelf && "items-end")}>
        {/* Sender Name for group chats */}
        {isGroup && !isSelf && (
          <span className="text-[11px] font-semibold text-indigo-400 ml-1 mb-0.5">
            {message.sender?.name}
          </span>
        )}

        {/* Bubble */}
        <div
          className={cn(
            "relative px-4 py-2.5 rounded-2xl text-sm break-words shadow-sm transition-all",
            isSelf
              ? "bg-indigo-600 text-white rounded-br-xs"
              : "bg-slate-800/90 text-slate-100 border border-slate-700/60 rounded-bl-xs",
            isDeleted && "italic opacity-60 bg-slate-800/40 border-dashed text-slate-400"
          )}
        >
          {/* Quoted Reply Banner */}
          {message.replyTo && (
            <div
              className={cn(
                "mb-2 p-2 rounded-lg text-xs border-l-2 bg-black/20 text-slate-300",
                isSelf ? "border-white/60" : "border-indigo-400"
              )}
            >
              <span className="font-semibold block text-[11px] text-indigo-300">
                {message.replyTo.sender?.name || "User"}
              </span>
              <p className="line-clamp-2">
                {message.replyTo.deletedAt
                  ? "This message was deleted"
                  : message.replyTo.content || "Attachment"}
              </p>
            </div>
          )}

          {/* Image Attachment */}
          {message.attachmentUrl && message.type === "IMAGE" && (
            <div
              className="relative my-1 rounded-xl overflow-hidden cursor-pointer max-w-sm border border-black/20 hover:opacity-95 transition"
              onClick={() => onImageClick?.(message.attachmentUrl!)}
            >
              <Image
                src={message.attachmentUrl}
                alt={message.attachmentName || "Attachment"}
                width={400}
                height={300}
                className="w-full h-auto object-cover max-h-72 rounded-lg"
                unoptimized
              />
            </div>
          )}

          {/* File Attachment */}
          {message.attachmentUrl && message.type === "FILE" && (
            <div className="flex items-center gap-3 p-2.5 my-1 rounded-xl bg-black/25 border border-white/10">
              <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="font-medium text-xs truncate">
                  {message.attachmentName || "Document"}
                </p>
                <p className="text-[10px] text-slate-300 opacity-80">
                  {formatFileSize(message.attachmentSize)}
                </p>
              </div>
              <a
                href={message.attachmentUrl}
                download={message.attachmentName || "download"}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 hover:bg-white/10 rounded-lg transition text-slate-200"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
          )}

          {/* Message Text Content */}
          {message.content && (
            <p className="whitespace-pre-wrap leading-relaxed select-text">{message.content}</p>
          )}

          {/* Metadata Row: Timestamp, Edited label, Status indicator */}
          <div
            className={cn(
              "flex items-center gap-1.5 mt-1 text-[10px] select-none",
              isSelf ? "justify-end text-indigo-200/80" : "justify-end text-slate-400"
            )}
          >
            {message.editedAt && !isDeleted && (
              <span className="opacity-80 italic">(edited)</span>
            )}
            <span>{formatMessageTime(message.createdAt)}</span>

            {/* Delivery / Seen status for sender */}
            {isSelf && (
              <span className="inline-flex items-center ml-0.5">
                {message.isOptimistic ? (
                  <span title="Sending..."><Clock className="w-3 h-3 text-indigo-300/70 animate-pulse" /></span>
                ) : isSeen ? (
                  <span title="Seen"><CheckCheck className="w-3.5 h-3.5 text-sky-300 font-bold" /></span>
                ) : (
                  <span title="Delivered"><Check className="w-3.5 h-3.5 text-indigo-300/80" /></span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Reaction Badges Below Bubble */}
        {Object.keys(reactionCounts).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 px-1">
            {Object.entries(reactionCounts).map(([emoji, data]) => (
              <button
                key={emoji}
                onClick={() => onReact(message.id, emoji)}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-all active:scale-95",
                  data.userReacted
                    ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300 shadow-xs"
                    : "bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-700/80"
                )}
              >
                <span>{emoji}</span>
                <span>{data.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
