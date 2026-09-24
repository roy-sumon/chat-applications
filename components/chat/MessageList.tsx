"use client";

import React, { useEffect, useRef, useState } from "react";
import { MessageWithDetails } from "@/types";
import { MessageItem } from "./MessageItem";
import { Modal } from "@/components/ui/Modal";
import Image from "next/image";
import { Loader2, MessageSquare, ArrowDown } from "lucide-react";

interface MessageListProps {
  messages: MessageWithDetails[];
  currentUserId: string;
  isGroup?: boolean;
  isLoading: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  typingUsers: string[];
  onLoadMore: () => void;
  onReply: (message: MessageWithDetails) => void;
  onEdit: (message: MessageWithDetails) => void;
  onDelete: (messageId: string) => void;
  onReact: (messageId: string, emoji: string) => void;
}

export function MessageList({
  messages,
  currentUserId,
  isGroup = false,
  isLoading,
  hasMore,
  isLoadingMore,
  typingUsers,
  onLoadMore,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Auto-scroll to bottom on initial load and when new messages arrive
  useEffect(() => {
    if (!isLoadingMore) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, typingUsers.length, isLoadingMore]);

  // Track scroll position to show scroll-to-bottom button
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isFarFromBottom = scrollHeight - scrollTop - clientHeight > 300;
    setShowScrollBottom(isFarFromBottom);
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-xs">Loading message history...</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-indigo-400 mb-3 shadow-inner">
          <MessageSquare className="w-6 h-6" />
        </div>
        <h4 className="font-semibold text-slate-200 text-sm">No messages yet</h4>
        <p className="text-xs text-slate-400 max-w-xs mt-1">
          Say hello to begin the conversation!
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-1 relative scroll-smooth"
    >
      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center mb-4">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition flex items-center gap-1.5"
          >
            {isLoadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
            {isLoadingMore ? "Loading earlier messages..." : "Load earlier messages"}
          </button>
        </div>
      )}

      {/* Messages */}
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          currentUserId={currentUserId}
          isGroup={isGroup}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          onReact={onReact}
          onImageClick={(url) => setSelectedImage(url)}
        />
      ))}

      {/* Typing Indicator Bubble */}
      {typingUsers.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-400 italic py-1 px-3">
          <span className="flex gap-1 items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.4s]" />
          </span>
          <span>{typingUsers.join(", ")} {typingUsers.length > 1 ? "are" : "is"} typing...</span>
        </div>
      )}

      <div ref={bottomRef} />

      {/* Floating Scroll to Bottom button */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
          className="fixed bottom-20 right-6 z-20 p-2.5 rounded-full bg-indigo-600 text-white shadow-xl hover:bg-indigo-500 transition animate-in zoom-in-90"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {/* Image Lightbox Modal */}
      <Modal
        isOpen={Boolean(selectedImage)}
        onClose={() => setSelectedImage(null)}
        maxWidth="2xl"
      >
        {selectedImage && (
          <div className="relative w-full max-h-[80vh] flex items-center justify-center overflow-hidden rounded-xl">
            <Image
              src={selectedImage}
              alt="Enlarged attachment preview"
              width={1000}
              height={800}
              className="w-auto h-auto max-h-[75vh] object-contain rounded-lg"
              unoptimized
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
