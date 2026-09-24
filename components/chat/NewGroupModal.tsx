"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { UserSummary } from "@/types";
import { Search, Check, Loader2 } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";

interface NewGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: (conversationId: string) => void;
  isUserOnline: (userId: string) => boolean;
}

export function NewGroupModal({
  isOpen,
  onClose,
  onGroupCreated,
  isUserOnline,
}: NewGroupModalProps) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setAvatar("");
      setQuery("");
      setSelectedUserIds([]);
      setUsers([]);
      return;
    }

    const fetchUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const res = await fetch(`/api/users?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        if (res.ok) {
          setUsers(data.users || []);
        }
      } catch (err) {
        console.error("Failed to fetch users:", err);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    const timer = setTimeout(fetchUsers, 250);
    return () => clearTimeout(timer);
  }, [isOpen, query]);

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please provide a group name.", "Validation Error");
      return;
    }

    if (selectedUserIds.length === 0) {
      toast.error("Please select at least one member.", "Validation Error");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isGroup: true,
          name: name.trim(),
          avatar: avatar.trim() || undefined,
          memberIds: selectedUserIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create group");
      }

      toast.success("Group created successfully!", "Success");
      onGroupCreated(data.conversation.id);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error creating group";
      toast.error(msg, "Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Group"
      description="Collaborate with multiple team members"
      maxWidth="md"
    >
      <form onSubmit={handleCreateGroup} className="space-y-4">
        <Input
          label="Group Name *"
          placeholder="Product Engineering Team"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Input
          label="Group Avatar URL (optional)"
          placeholder="https://example.com/team-icon.png"
          value={avatar}
          onChange={(e) => setAvatar(e.target.value)}
        />

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-300">
            Select Members ({selectedUserIds.length} selected)
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-800 text-xs text-slate-100 placeholder:text-slate-500 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 divide-y divide-slate-800/40 mt-2 pr-1">
            {isLoadingUsers ? (
              <div className="py-6 flex items-center justify-center text-slate-500 text-xs gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Loading users...</span>
              </div>
            ) : users.length === 0 ? (
              <p className="text-center text-xs text-slate-500 py-6">No users found.</p>
            ) : (
              users.map((u) => {
                const isSelected = selectedUserIds.includes(u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => toggleSelectUser(u.id)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800 cursor-pointer transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        src={u.avatar}
                        name={u.name}
                        size="xs"
                        isOnline={isUserOnline(u.id)}
                        showOnlineStatus={true}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-200 truncate">{u.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                        isSelected
                          ? "bg-indigo-600 border-indigo-500 text-white"
                          : "border-slate-700 bg-slate-900"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            disabled={!name.trim() || selectedUserIds.length === 0}
          >
            Create Group
          </Button>
        </div>
      </form>
    </Modal>
  );
}
