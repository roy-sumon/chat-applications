"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConversationWithDetails, UserSummary } from "@/types";
import { UserPlus, UserMinus, ShieldAlert, LogOut, Loader2, Save } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";

interface GroupDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: ConversationWithDetails;
  currentUserId: string;
  isUserOnline: (userId: string) => boolean;
  onGroupUpdated: () => void;
  onLeaveGroup: () => void;
}

export function GroupDetailsModal({
  isOpen,
  onClose,
  conversation,
  currentUserId,
  isUserOnline,
  onGroupUpdated,
  onLeaveGroup,
}: GroupDetailsModalProps) {
  const isGroup = conversation.type === "GROUP";
  const currentUserMember = conversation.members.find((m) => m.userId === currentUserId);
  const isAdmin = currentUserMember?.role === "ADMIN";

  const [groupName, setGroupName] = useState(conversation.name || "");
  const [groupAvatar, setGroupAvatar] = useState(conversation.avatar || "");
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  // Add member search state
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchUsers, setSearchUsers] = useState<UserSummary[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    setGroupName(conversation.name || "");
    setGroupAvatar(conversation.avatar || "");
  }, [conversation]);

  // Fetch users available to add
  useEffect(() => {
    if (!showAddMember) {
      setSearchUsers([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const res = await fetch(`/api/users?q=${encodeURIComponent(searchQuery.trim())}`);
        const data = await res.json();
        if (res.ok) {
          const currentMemberIds = new Set(conversation.members.map((m) => m.userId));
          // Filter out users already in the group
          const available = (data.users || []).filter((u: UserSummary) => !currentMemberIds.has(u.id));
          setSearchUsers(available);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [showAddMember, searchQuery, conversation.members]);

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setIsSavingDetails(true);
    try {
      const res = await fetch(`/api/conversations/${conversation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName.trim(),
          avatar: groupAvatar.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update group");
      }

      toast.success("Group details updated.");
      onGroupUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error updating group";
      toast.error(msg, "Error");
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    setActionLoadingId(userId);
    try {
      const res = await fetch(`/api/conversations/${conversation.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add member");
      }

      toast.success("Member added to group.");
      onGroupUpdated();
      setShowAddMember(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error adding member";
      toast.error(msg, "Error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setActionLoadingId(userId);
    try {
      const res = await fetch(`/api/conversations/${conversation.id}/members?userId=${userId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove member");
      }

      if (userId === currentUserId) {
        toast.info("You left the group.");
        onLeaveGroup();
        onClose();
      } else {
        toast.success("Member removed.");
        onGroupUpdated();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error removing member";
      toast.error(msg, "Error");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isGroup ? "Group Details" : "Conversation Info"}
      description={isGroup ? `Manage members and settings` : undefined}
      maxWidth="md"
    >
      <div className="space-y-5">
        {/* If Group and Admin: Edit details form */}
        {isGroup && isAdmin && (
          <form onSubmit={handleUpdateGroup} className="space-y-3 pb-4 border-b border-slate-800">
            <Input
              label="Group Name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
            />
            <Input
              label="Group Avatar URL"
              value={groupAvatar}
              onChange={(e) => setGroupAvatar(e.target.value)}
              placeholder="https://..."
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSavingDetails}
                leftIcon={<Save className="w-3.5 h-3.5" />}
              >
                Save Changes
              </Button>
            </div>
          </form>
        )}

        {/* Member List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Members ({conversation.members.length})
            </h4>
            {isGroup && isAdmin && (
              <button
                type="button"
                onClick={() => setShowAddMember(!showAddMember)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{showAddMember ? "Close" : "Add Member"}</span>
              </button>
            )}
          </div>

          {/* Add Member Search Panel */}
          {showAddMember && (
            <div className="p-3 mb-3 bg-slate-800/80 border border-slate-700 rounded-xl space-y-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user to add..."
                className="w-full h-8 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="max-h-36 overflow-y-auto space-y-1">
                {isSearchingUsers ? (
                  <div className="flex items-center justify-center p-3 text-xs text-slate-500 gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Searching...</span>
                  </div>
                ) : searchUsers.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 py-2">No eligible users found.</p>
                ) : (
                  searchUsers.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-900 transition text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Avatar src={u.avatar} name={u.name} size="xs" />
                        <span className="truncate text-slate-200">{u.name}</span>
                      </div>
                      <button
                        onClick={() => handleAddMember(u.id)}
                        disabled={actionLoadingId === u.id}
                        className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] transition"
                      >
                        {actionLoadingId === u.id ? "Adding..." : "Add"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Members Table */}
          <div className="max-h-60 overflow-y-auto space-y-1 divide-y divide-slate-800/60 pr-1">
            {conversation.members.map((m) => {
              const online = isUserOnline(m.userId);
              const isSelf = m.userId === currentUserId;

              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/40 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar
                      src={m.user.avatar}
                      name={m.user.name}
                      size="sm"
                      isOnline={online}
                      showOnlineStatus={true}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-200 truncate">
                          {m.user.name}
                        </span>
                        {isSelf && (
                          <span className="text-[10px] text-slate-400 italic">(You)</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">{m.user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {m.role === "ADMIN" ? (
                      <Badge variant="primary" size="sm">Admin</Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">Member</Badge>
                    )}

                    {/* Admin remove member button */}
                    {isGroup && isAdmin && !isSelf && (
                      <button
                        onClick={() => handleRemoveMember(m.userId)}
                        disabled={actionLoadingId === m.userId}
                        title="Remove member"
                        className="p-1 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leave Group Action */}
        {isGroup && (
          <div className="pt-3 border-t border-slate-800 flex justify-end">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => handleRemoveMember(currentUserId)}
              disabled={actionLoadingId === currentUserId}
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              <span>Leave Group</span>
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
