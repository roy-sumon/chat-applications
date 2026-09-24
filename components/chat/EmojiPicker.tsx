"use client";

import React from "react";
import { Smile } from "lucide-react";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const COMMON_EMOJIS = [
  "👍", "❤️", "😂", "🔥", "🎉", "😮", "😢", "👏", 
  "🙌", "✨", "💯", "🚀", "😍", "🤝", "🙏", "😎",
  "🤔", "👀", "💪", "💡", "🥳", "🌟", "😴", "🫡"
];

export function EmojiPicker({ onSelect, isOpen, onClose }: EmojiPickerProps) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute bottom-14 left-0 sm:left-0 z-40 p-3 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl w-64 max-w-[calc(100vw-3rem)] animate-in zoom-in-95 fade-in">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-2 px-1">
          <Smile className="w-3.5 h-3.5" />
          <span>Quick Emojis</span>
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onSelect(emoji);
                onClose();
              }}
              className="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-800 rounded-lg transition active:scale-95"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
