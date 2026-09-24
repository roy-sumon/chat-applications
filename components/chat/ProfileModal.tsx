"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { UserSummary } from "@/types";
import { useToast } from "@/components/providers/ToastProvider";
import { useSession } from "next-auth/react";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserSummary;
  onProfileUpdated: (updatedUser: UserSummary) => void;
}

export function ProfileModal({
  isOpen,
  onClose,
  currentUser,
  onProfileUpdated,
}: ProfileModalProps) {
  const { update: updateSession } = useSession();
  const [name, setName] = useState(currentUser.name);
  const [bio, setBio] = useState(currentUser.bio || "");
  const [avatar, setAvatar] = useState(currentUser.avatar || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setName(currentUser.name);
    setBio(currentUser.bio || "");
    setAvatar(currentUser.avatar || "");
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name cannot be empty.", "Validation Error");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          bio: bio.trim() || null,
          avatar: avatar.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      toast.success("Profile updated successfully!");
      // Update NextAuth session
      await updateSession({
        name: data.user.name,
        image: data.user.avatar,
      });

      onProfileUpdated(data.user);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error updating profile";
      toast.error(msg, "Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Profile"
      description="Update your personal details and avatar"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Avatar Preview */}
        <div className="flex flex-col items-center justify-center gap-2 pb-2">
          <Avatar
            src={avatar || null}
            name={name || "User"}
            size="2xl"
            isOnline={true}
            showOnlineStatus={true}
          />
          <span className="text-xs text-slate-400">Avatar Preview</span>
        </div>

        <Input
          label="Full Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-300">
            Bio (Optional)
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell your team about yourself..."
            maxLength={200}
            rows={2}
            className="w-full py-2.5 px-3.5 bg-slate-900 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          <span className="text-[10px] text-slate-500 text-right block">
            {bio.length}/200
          </span>
        </div>

        <Input
          label="Avatar URL (Optional)"
          placeholder="https://images.unsplash.com/photo-..."
          value={avatar}
          onChange={(e) => setAvatar(e.target.value)}
        />

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
