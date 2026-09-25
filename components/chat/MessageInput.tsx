"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Paperclip,
  Smile,
  X,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mic,
  Square,
} from "lucide-react";
import { EmojiPicker } from "./EmojiPicker";
import { MessageWithDetails, UserSummary } from "@/types";
import { formatFileSize, cn } from "@/lib/utils";
import { useToast } from "@/components/providers/ToastProvider";
import { playSendSound } from "@/lib/utils/sound";
import { getSocketClient } from "@/lib/realtime/socket";

interface MessageInputProps {
  conversationId: string;
  currentUser?: UserSummary;
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
  currentUser,
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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isCancelledRef = useRef(false);
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

  // Clean up recording timers on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Typing indicator broadcast
  const sendTypingStatus = async (isTyping: boolean) => {
    if (isTypingRef.current === isTyping) return;
    isTypingRef.current = isTyping;

    // 1. Instant Socket.io emission
    const socket = getSocketClient();
    if (socket && socket.connected && currentUser) {
      socket.emit("chat:typing", {
        conversationId,
        userId: currentUser.id,
        userName: currentUser.name,
        isTyping,
      });
    }

    // 2. HTTP API fallback
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

  // Start voice note recording
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Microphone recording is not supported in this browser.", "Not Supported");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      isCancelledRef.current = false;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop audio tracks
        stream.getTracks().forEach((track) => track.stop());

        if (isCancelledRef.current) {
          audioChunksRef.current = [];
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (audioBlob.size < 500) {
          toast.info("Voice message too short.", "Cancelled");
          return;
        }

        setIsUploading(true);
        try {
          const formData = new FormData();
          formData.append("file", audioBlob, `voice-${Date.now()}.webm`);

          const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Failed to upload voice note");
          }

          await onSendMessage({
            content: "🎤 Voice Message",
            type: "FILE",
            attachmentUrl: data.url,
            attachmentName: `Voice Note (${recordingSeconds}s)`,
            attachmentSize: audioBlob.size,
            attachmentType: "audio/webm",
            replyToId: replyingTo ? replyingTo.id : null,
          });

          playSendSound();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Voice note upload failed";
          toast.error(msg, "Error");
        } finally {
          setIsUploading(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      toast.error("Microphone access denied. Please allow microphone permissions.", "Permission Error");
    }
  };

  const stopRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    isCancelledRef.current = true;
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    toast.info("Voice recording cancelled.");
  };

  const handleSubmit = async () => {
    if (isRecording) {
      stopRecording();
      return;
    }

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

        playSendSound();
        setContent("");
        setAttachment(null);
      }
    } catch (error) {
      console.error("Failed to submit message:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="p-3 sm:p-4 bg-slate-900/95 border-t border-slate-800/80 backdrop-blur-md relative select-none">
      {/* Replying Banner */}
      {replyingTo && (
        <div className="flex items-center justify-between gap-2 mb-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
          <div className="truncate">
            <span className="font-semibold text-indigo-400">Replying to {replyingTo.sender?.name || "User"}:</span>{" "}
            <span className="opacity-80 truncate">{replyingTo.content || "Attachment"}</span>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition shrink-0"
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
          accept="image/*,.pdf,.doc,.docx,.txt,.zip,audio/*"
        />

        {/* Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isRecording}
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
            disabled={isRecording}
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

        {/* Voice Note Record Button */}
        {!isRecording && (
          <button
            type="button"
            onClick={startRecording}
            disabled={isUploading || Boolean(content.trim())}
            title="Record voice note"
            className="p-2.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition shrink-0 hidden sm:inline-flex"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}

        {/* Text Input Area OR Recording View */}
        {isRecording ? (
          <div className="flex-1 flex items-center justify-between gap-3 px-3.5 py-2 bg-rose-950/30 border border-rose-600/30 rounded-xl text-rose-300 animate-in fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
              <span className="text-xs font-semibold truncate">
                Recording... {formatTimer(recordingSeconds)}
              </span>
            </div>
            <button
              type="button"
              onClick={cancelRecording}
              className="text-xs font-semibold px-2 py-1 bg-rose-900/60 hover:bg-rose-900 rounded-lg text-rose-200 transition shrink-0"
            >
              Cancel
            </button>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={editingMessage ? "Edit message..." : "Type a message..."}
            rows={1}
            className="flex-1 max-h-32 min-h-[42px] py-2 px-3 sm:py-2.5 sm:px-3.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none transition"
          />
        )}

        {/* Send / Stop Recording Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || (!isRecording && !content.trim() && !attachment)}
          className={cn(
            "p-2.5 rounded-xl font-medium transition-all duration-200 shrink-0",
            isRecording
              ? "bg-rose-600 text-white hover:bg-rose-500 shadow-md active:scale-95 animate-pulse"
              : content.trim() || attachment
              ? "bg-indigo-600 text-white hover:bg-indigo-500 shadow-md active:scale-95"
              : "bg-slate-800 text-slate-500 cursor-not-allowed"
          )}
          title={isRecording ? "Stop & Send Voice Note" : "Send message"}
        >
          {isSubmitting || isUploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isRecording ? (
            <Square className="w-5 h-5 fill-current" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
