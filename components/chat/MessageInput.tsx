"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Smile, X, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { EmojiPicker } from "./EmojiPicker";
import { MessageWithDetails } from "@/types";
import { formatFileSize, cn } from "@/lib/utils";
import { useToast } from "@/components/providers/ToastProvider";

interface MessageInputProps {
  conversationId: string;
  onSendMessage: (payload: {
    content?: string;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
    attachmentSize?: number | null;
    attachmentType?: string | null;
    type?: "TEXT" | "IMAGE" | "FILE";
    replyToId?: string | null;
  }) => Promise<void>;
  replyingTo: MessageWithDetails | null;
  onCancelReply: () => void;
  editingMessage: MessageWithDetails | null;
  onCancelEdit: () => void;
  onSaveEdit: (messageId: string, newContent: string) => Promise<void>;
}

export function MessageInput({
  conversationId,
  onSendMessage,
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  onSaveEdit,
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachment, setAttachment] = useState<{
    url: string;
    name: string;
    size: number;
    type: "IMAGE" | "FILE";
    mimeType: string;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const { toast } = useToast();

  // Populate content if editing
  useEffect(() => {
    if (editingMessage) {
      setContent(editingMessage.content || "");
      textareaRef.current?.focus();
    }
  }, [editingMessage]);

  // Focus input when replying
  useEffect(() => {
    if (replyingTo) {
      textareaRef.current?.focus();
    }
  }, [replyingTo]);

  // Typing indicator broadcast
  const sendTypingStatus = async (isTyping: boolean) => {
    if (isTypingRef.current === isTyping) return;
    isTypingRef.current = isTyping;

    try {
      await fetch(`/api/conversations/${conversationId}/typing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTyping }),
      });
    } catch {
      // ignore typing broadcast errors
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);

    // Broadcast typing start
    sendTypingStatus(true);

    // Reset typing debounce timer
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStatus(false);
    }, 2500);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds 10MB limit.", "Upload Failed");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setAttachment({
        url: data.url,
        name: data.name,
        size: data.size,
        type: data.type,
        mimeType: data.mimeType,
      });
      toast.success("Attachment ready to send.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload file";
      toast.error(msg, "Upload Failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed && !attachment) return;
    if (isSubmitting) return;

    setIsSubmitting(true);

    // Stop typing indicator immediately
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendTypingStatus(false);

    try {
      if (editingMessage) {
        await onSaveEdit(editingMessage.id, trimmed);
        setContent("");
      } else {
        await onSendMessage({
          content: trimmed || undefined,
          attachmentUrl: attachment?.url || null,
          attachmentName: attachment?.name || null,
          attachmentSize: attachment?.size || null,
          attachmentType: attachment?.mimeType || null,
          type: attachment ? attachment.type : "TEXT",
          replyToId: replyingTo ? replyingTo.id : null,
        });

        setContent("");
        setAttachment(null);
      }
    } catch (error) {
      console.error("Failed to submit message:", error);
    } finally {
      setIsSubmitting(false);
      textareaRef.current?.focus();
    }
  };

  return (
    <div className="relative border-t border-slate-800/80 bg-slate-900/90 backdrop-blur-md px-4 py-3">
      {/* Replying Banner */}
      {replyingTo && (
        <div className="flex items-center justify-between gap-2 mb-2 px-3 py-1.5 rounded-xl bg-indigo-950/60 border border-indigo-700/40 text-xs text-indigo-200">
          <div className="truncate">
            <span className="font-semibold text-indigo-300">
              Replying to {replyingTo.sender?.name || "User"}:
            </span>{" "}
            <span className="opacity-80 truncate">{replyingTo.content || "Attachment"}</span>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 hover:bg-indigo-900/60 rounded-lg text-indigo-300 transition shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Editing Banner */}
      {editingMessage && (
        <div className="flex items-center justify-between gap-2 mb-2 px-3 py-1.5 rounded-xl bg-amber-950/60 border border-amber-700/40 text-xs text-amber-200">
          <div className="truncate">
            <span className="font-semibold text-amber-300">Editing message:</span>{" "}
            <span className="opacity-80 truncate">{editingMessage.content}</span>
          </div>
          <button
            onClick={onCancelEdit}
            className="p-1 hover:bg-amber-900/60 rounded-lg text-amber-300 transition shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Attachment Preview Badge */}
      {attachment && (
        <div className="flex items-center gap-3 mb-2 p-2.5 rounded-xl bg-slate-800/90 border border-slate-700 max-w-sm">
          {attachment.type === "IMAGE" ? (
            <ImageIcon className="w-5 h-5 text-indigo-400 shrink-0" />
          ) : (
            <FileText className="w-5 h-5 text-indigo-400 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-200 truncate">{attachment.name}</p>
            <p className="text-[10px] text-slate-400">{formatFileSize(attachment.size)}</p>
          </div>
          <button
            onClick={() => setAttachment(null)}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Row */}
      <div className="flex items-end gap-2">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.txt,.zip"
        />

        {/* Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          title="Attach file or image"
          className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition shrink-0"
        >
          {isUploading ? (
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          ) : (
            <Paperclip className="w-5 h-5" />
          )}
        </button>

        {/* Emoji Button */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Add emoji"
            className="p-2.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-xl transition"
          >
            <Smile className="w-5 h-5" />
          </button>
          <EmojiPicker
            isOpen={showEmojiPicker}
            onClose={() => setShowEmojiPicker(false)}
            onSelect={(emoji) => {
              setContent((prev) => prev + emoji);
              textareaRef.current?.focus();
            }}
          />
        </div>

        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={editingMessage ? "Edit message..." : "Type a message... (Enter to send, Shift+Enter for new line)"}
          rows={1}
          className="flex-1 max-h-32 min-h-[42px] py-2.5 px-3.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none transition"
        />

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || (!content.trim() && !attachment)}
          className={cn(
            "p-2.5 rounded-xl font-medium transition-all duration-200 shrink-0",
            content.trim() || attachment
              ? "bg-indigo-600 text-white hover:bg-indigo-500 shadow-md active:scale-95"
              : "bg-slate-800 text-slate-500 cursor-not-allowed"
          )}
          title="Send message"
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
