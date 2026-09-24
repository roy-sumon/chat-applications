import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  sendMessageSchema,
  createGroupConversationSchema,
  createDirectConversationSchema,
  updateProfileSchema,
  reactionSchema,
} from "@/lib/validation";

describe("Validation Schemas", () => {
  describe("registerSchema", () => {
    it("should accept valid registration inputs", () => {
      const valid = {
        name: "Alex Mercer",
        email: "alex@example.com",
        password: "securePassword123!",
      };
      const result = registerSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("alex@example.com");
      }
    });

    it("should reject invalid email addresses", () => {
      const invalid = {
        name: "Alex",
        email: "not-an-email",
        password: "password123",
      };
      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject passwords shorter than 6 characters", () => {
      const invalid = {
        name: "Alex",
        email: "alex@example.com",
        password: "123",
      };
      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject names shorter than 2 characters", () => {
      const invalid = {
        name: "A",
        email: "alex@example.com",
        password: "password123",
      };
      const result = registerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("loginSchema", () => {
    it("should accept valid login inputs", () => {
      const valid = {
        email: "USER@EXAMPLE.COM",
        password: "mySecretPassword",
      };
      const result = loginSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("user@example.com");
      }
    });

    it("should reject missing password", () => {
      const invalid = {
        email: "user@example.com",
        password: "",
      };
      const result = loginSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("sendMessageSchema", () => {
    it("should accept message with text content", () => {
      const valid = {
        conversationId: "conv123",
        content: "Hello everyone!",
      };
      const result = sendMessageSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should accept message with attachment URL without text", () => {
      const valid = {
        conversationId: "conv123",
        type: "IMAGE" as const,
        attachmentUrl: "https://example.com/photo.png",
      };
      const result = sendMessageSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject message with both empty content and no attachment", () => {
      const invalid = {
        conversationId: "conv123",
        content: "   ",
        attachmentUrl: "",
      };
      const result = sendMessageSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("createGroupConversationSchema", () => {
    it("should accept valid group creation payload", () => {
      const valid = {
        name: "Engineering Core",
        memberIds: ["user2", "user3"],
      };
      const result = createGroupConversationSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject group creation with no members", () => {
      const invalid = {
        name: "Solo Group",
        memberIds: [],
      };
      const result = createGroupConversationSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject empty group name", () => {
      const invalid = {
        name: "",
        memberIds: ["user2"],
      };
      const result = createGroupConversationSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("createDirectConversationSchema", () => {
    it("should require recipientId", () => {
      expect(createDirectConversationSchema.safeParse({ recipientId: "u123" }).success).toBe(true);
      expect(createDirectConversationSchema.safeParse({ recipientId: "" }).success).toBe(false);
    });
  });

  describe("updateProfileSchema", () => {
    it("should validate name and bio length limits", () => {
      const valid = {
        name: "Jordan Smith",
        bio: "Senior Full-Stack Engineer passionate about real-time distributed systems.",
      };
      expect(updateProfileSchema.safeParse(valid).success).toBe(true);

      const tooLongBio = {
        name: "Jordan",
        bio: "a".repeat(201),
      };
      expect(updateProfileSchema.safeParse(tooLongBio).success).toBe(false);
    });
  });

  describe("reactionSchema", () => {
    it("should validate emoji reaction", () => {
      expect(reactionSchema.safeParse({ messageId: "msg1", reaction: "❤️" }).success).toBe(true);
      expect(reactionSchema.safeParse({ messageId: "msg1", reaction: "" }).success).toBe(false);
    });
  });
});
