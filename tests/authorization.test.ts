import { describe, it, expect } from "vitest";

// Authorization policy logic helper functions matching the application's service layer
function canEditMessage(message: { senderId: string; deletedAt: Date | null }, currentUserId: string) {
  if (message.deletedAt) {
    return { allowed: false, reason: "Cannot edit a deleted message." };
  }
  if (message.senderId !== currentUserId) {
    return { allowed: false, reason: "Forbidden: You can only edit your own messages." };
  }
  return { allowed: true };
}

function canDeleteMessage(message: { senderId: string }, currentUserId: string) {
  if (message.senderId !== currentUserId) {
    return { allowed: false, reason: "Forbidden: You can only delete your own messages." };
  }
  return { allowed: true };
}

function canManageGroupMembers(
  requesterRole: "ADMIN" | "MEMBER",
  targetUserId: string,
  requesterUserId: string
) {
  // Any member can leave (target === requester)
  if (targetUserId === requesterUserId) {
    return { allowed: true, action: "leave" };
  }
  // Only admins can remove/add other members
  if (requesterRole !== "ADMIN") {
    return { allowed: false, reason: "Forbidden: Only admins can manage group members." };
  }
  return { allowed: true, action: "manage" };
}

function canAccessConversation(
  members: Array<{ userId: string }>,
  currentUserId: string
) {
  return members.some((m) => m.userId === currentUserId);
}

describe("Security & Authorization Policies", () => {
  describe("Message Editing Authorization", () => {
    it("should allow the message author to edit their message", () => {
      const msg = { senderId: "user-1", deletedAt: null };
      const auth = canEditMessage(msg, "user-1");
      expect(auth.allowed).toBe(true);
    });

    it("should forbid another user from editing a message", () => {
      const msg = { senderId: "user-1", deletedAt: null };
      const auth = canEditMessage(msg, "user-2");
      expect(auth.allowed).toBe(false);
      expect(auth.reason).toContain("only edit your own messages");
    });

    it("should forbid editing a deleted message", () => {
      const msg = { senderId: "user-1", deletedAt: new Date() };
      const auth = canEditMessage(msg, "user-1");
      expect(auth.allowed).toBe(false);
      expect(auth.reason).toContain("deleted");
    });
  });

  describe("Message Deletion Authorization", () => {
    it("should allow the message author to delete their message", () => {
      const msg = { senderId: "user-1" };
      const auth = canDeleteMessage(msg, "user-1");
      expect(auth.allowed).toBe(true);
    });

    it("should forbid non-authors from deleting a message", () => {
      const msg = { senderId: "user-1" };
      const auth = canDeleteMessage(msg, "user-2");
      expect(auth.allowed).toBe(false);
      expect(auth.reason).toContain("only delete your own messages");
    });
  });

  describe("Group Membership & Role Authorization", () => {
    it("should allow an ADMIN to add or remove members", () => {
      const auth = canManageGroupMembers("ADMIN", "user-2", "user-admin");
      expect(auth.allowed).toBe(true);
    });

    it("should forbid a regular MEMBER from removing other members", () => {
      const auth = canManageGroupMembers("MEMBER", "user-3", "user-2");
      expect(auth.allowed).toBe(false);
      expect(auth.reason).toContain("Only admins");
    });

    it("should allow a regular MEMBER to leave the group themselves", () => {
      const auth = canManageGroupMembers("MEMBER", "user-2", "user-2");
      expect(auth.allowed).toBe(true);
      expect(auth.action).toBe("leave");
    });
  });

  describe("Conversation Membership Verification", () => {
    const conversation = {
      id: "conv-1",
      members: [{ userId: "user-1" }, { userId: "user-2" }],
    };

    it("should permit members to access conversation messages", () => {
      expect(canAccessConversation(conversation.members, "user-1")).toBe(true);
      expect(canAccessConversation(conversation.members, "user-2")).toBe(true);
    });

    it("should deny access to non-members", () => {
      expect(canAccessConversation(conversation.members, "user-intruder")).toBe(false);
    });
  });
});
