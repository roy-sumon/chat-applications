"use client";

import React, { useState, useEffect } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { formatMessageTime } from "@/lib/utils";

interface ConversationSearchProps {
  conversationId: string;
  onClose: () => void;
  onSelectMessage?: (messageId: string) => void;
}

interface SearchResult {
  id: string;
  content: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    avatar?: string | null;
  };
}

export function ConversationSearch({
  conversationId,
  onClose,
  onSelectMessage,
}: ConversationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/conversations/${conversationId}/search?q=${encodeURIComponent(query.trim())}`
        );
        const data = await res.json();
        if (res.ok) {
          setResults(data.messages || []);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, conversationId]);

  return (
    <div className="border-b border-slate-800 bg-slate-900/95 p-3 animate-in slide-in-from-top-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages in this conversation..."
            autoFocus
            className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-800 text-xs text-slate-100 placeholder:text-slate-500 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center p-3 text-slate-400 text-xs gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
          <span>Searching...</span>
        </div>
      )}

      {!isLoading && query && results.length === 0 && (
        <p className="text-center text-xs text-slate-500 py-3">No messages found matching &quot;{query}&quot;</p>
      )}

      {results.length > 0 && (
        <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
          {results.map((res) => (
            <div
              key={res.id}
              onClick={() => onSelectMessage?.(res.id)}
              className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 cursor-pointer transition text-xs"
            >
              <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                <span className="font-semibold text-indigo-300">{res.sender.name}</span>
                <span>{formatMessageTime(res.createdAt)}</span>
              </div>
              <p className="text-slate-200 line-clamp-2">{res.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
