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
  Mic,
  Phone,
  PhoneMissed,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";

interface MessageItemProps {
  message: MessageWithDetails;
  currentUserId: string;
  isGroup?: boolean;
  onReply: (message: MessageWithDetails) => void;
  onEdit: (message: MessageWithDetails) => void;
  onDelete: (messageId: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onStartCall?: (type: "AUDIO" | "VIDEO") => void;
  onImageClick?: (url: string) => void;
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "😮", "🎉"];

function MessageItemComponent({
  message,
  currentUserId,
  isGroup = false,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onStartCall,
  onImageClick,
}: MessageItemProps) {
  const [showActions, setShowActions] = useState(false);
  const [showReactionMenu, setShowReactionMenu] = useState(false);

  const isSelf = message.senderId === currentUserId;
  const isDeleted = Boolean(message.deletedAt);
  const isSystem = message.type === "SYSTEM";
  const isCallMessage = message.content?.startsWith("CALL:");

  if (isCallMessage) {
    const parts = (message.content || "").split(":");
    const callStatus = parts[1] || "MISSED"; // MISSED | DECLINED | ENDED
    const callType = parts[2] === "VIDEO" ? "VIDEO" : "AUDIO";
    const durationSec = Number(parts[3]) || 0;

    const isMissed = callStatus === "MISSED";
    const isDeclined = callStatus === "DECLINED";
    const isEnded = callStatus === "ENDED";

    let title = "";
    if (isMissed) {
      title = isSelf
        ? `Outgoing ${callType === "VIDEO" ? "video" : "voice"} call`
        : `Missed ${callType === "VIDEO" ? "video" : "voice"} call`;
    } else if (isDeclined) {
      title = isSelf
        ? `Outgoing ${callType === "VIDEO" ? "video" : "voice"} call`
        : `Declined ${callType === "VIDEO" ? "video" : "voice"} call`;
    } else {
      title = `${callType === "VIDEO" ? "Video" : "Voice"} call`;
    }

    let subtext = "";
    if (isEnded) {
      const mins = Math.floor(durationSec / 60);
      const secs = durationSec % 60;
      subtext = `${mins > 0 ? `${mins}m ` : ""}${secs}s · ${formatMessageTime(message.createdAt)}`;
    } else if (isMissed) {
      subtext = isSelf
        ? `No answer · ${formatMessageTime(message.createdAt)}`
        : `Missed · ${formatMessageTime(message.createdAt)}`;
    } else {
      subtext = `Declined · ${formatMessageTime(message.createdAt)}`;
    }

    return (
      <div className={cn("flex my-2 select-none", isSelf ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-2xl max-w-sm border backdrop-blur-md shadow-md transition",
            isMissed && !isSelf
              ? "bg-rose-950/40 border-rose-800/50 text-rose-200"
              : isEnded
              ? "bg-slate-900/90 border-slate-800 text-slate-200"
              : "bg-slate-900/80 border-slate-800/80 text-slate-300"
          )}
        >
          {/* Icon */}
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
              isMissed && !isSelf
                ? "bg-rose-500/20 text-rose-400"
                : isEnded
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-slate-800 text-slate-400"
            )}
          >
            {callType === "VIDEO" ? (
              isMissed && !isSelf ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />
            ) : (
              isMissed && !isSelf ? (
                <PhoneMissed className="w-5 h-5" />
              ) : isSelf && isMissed ? (
                <PhoneOff className="w-5 h-5" />
              ) : (
                <Phone className="w-5 h-5" />
              )
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <h5 className="text-xs font-semibold leading-tight truncate text-slate-100">{title}</h5>
            <p className={cn("text-[11px] mt-0.5", isMissed && !isSelf ? "text-rose-400 font-medium" : "text-slate-400")}>
              {subtext}
            </p>
          </div>

          {/* Action Button: Call Back / Call Again */}
          {onStartCall && (
            <button
              onClick={() => onStartCall(callType)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition active:scale-95 flex items-center gap-1.5",
                isMissed && !isSelf
                  ? "bg-rose-600 hover:bg-rose-500 text-white shadow-sm"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200"
              )}
            >
              {callType === "VIDEO" ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
              <span>{isMissed && !isSelf ? "Call back" : "Call again"}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

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
        "group relative flex gap-2.5 my-1.5 transition-colors px-2 py-0.5 rounded-xl cursor-pointer sm:cursor-default",
        isSelf ? "justify-end" : "justify-start"
      )}
      onClick={() => setShowActions((prev) => !prev)}
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
      <div className={cn("flex flex-col max-w-[85%] sm:max-w-[70%]", isSelf && "items-end")}>
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

          {/* Voice Note / Audio or File Attachment */}
          {message.attachmentUrl && message.type === "FILE" && (
            message.attachmentType?.startsWith("audio/") ||
            message.attachmentName?.toLowerCase().includes("voice") ? (
              <div className="my-1.5 p-2 rounded-xl bg-black/25 border border-white/10 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-300">
                  <Mic className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{message.attachmentName || "Voice Message"}</span>
                </div>
                <audio
                  controls
                  src={message.attachmentUrl}
                  className="w-full max-w-[240px] sm:max-w-xs h-8 accent-indigo-500 rounded-lg"
                />
              </div>
            ) : (
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
            )
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

export const MessageItem = React.memo(MessageItemComponent);
