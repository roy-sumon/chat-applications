import { z } from "zod";

// ============================================================================
// AUTHENTICATION SCHEMAS
// ============================================================================

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Name must be at least 2 characters long." })
    .max(50, { message: "Name must not exceed 50 characters." }),
  email: z
    .string()
    .trim()
    .email({ message: "Please provide a valid email address." })
    .toLowerCase(),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters long." })
    .max(100, { message: "Password must not exceed 100 characters." }),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Please provide a valid email address." })
    .toLowerCase(),
  password: z.string().min(1, { message: "Password is required." }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// ============================================================================
// PROFILE SCHEMAS
// ============================================================================

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Name must be at least 2 characters long." })
    .max(50, { message: "Name must not exceed 50 characters." })
    .optional(),
  bio: z
    .string()
    .trim()
    .max(200, { message: "Bio cannot exceed 200 characters." })
    .nullable()
    .optional(),
  avatar: z
    .string()
    .trim()
    .url({ message: "Avatar must be a valid URL." })
    .or(z.literal(""))
    .nullable()
    .optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ============================================================================
// CONVERSATION SCHEMAS
// ============================================================================

export const createDirectConversationSchema = z.object({
  recipientId: z.string().min(1, { message: "Recipient ID is required." }),
});

export const createGroupConversationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Group name is required." })
    .max(60, { message: "Group name must be 60 characters or less." }),
  memberIds: z
    .array(z.string().min(1))
    .min(1, { message: "Select at least one member to create a group." }),
  avatar: z.string().trim().url().or(z.literal("")).nullable().optional(),
});

export const updateGroupSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  avatar: z.string().trim().url().or(z.literal("")).nullable().optional(),
});

export const manageMemberSchema = z.object({
  userId: z.string().min(1, { message: "User ID is required." }),
});

export type CreateDirectInput = z.infer<typeof createDirectConversationSchema>;
export type CreateGroupInput = z.infer<typeof createGroupConversationSchema>;

// ============================================================================
// MESSAGE SCHEMAS
// ============================================================================

export const sendMessageSchema = z
  .object({
    conversationId: z.string().min(1, { message: "Conversation ID is required." }),
    content: z.string().trim().optional(),
    type: z.enum(["TEXT", "IMAGE", "FILE", "SYSTEM"]).default("TEXT"),
    attachmentUrl: z.string().url().or(z.literal("")).nullable().optional(),
    attachmentName: z.string().nullable().optional(),
    attachmentSize: z.number().nonnegative().nullable().optional(),
    attachmentType: z.string().nullable().optional(),
    replyToId: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      // Must have either non-empty content or an attachmentUrl
      return (data.content && data.content.length > 0) || !!data.attachmentUrl;
    },
    {
      message: "Message must contain either text content or an attachment.",
      path: ["content"],
    }
  );

export const editMessageSchema = z.object({
  messageId: z.string().min(1, { message: "Message ID is required." }),
  content: z.string().trim().min(1, { message: "Content cannot be empty." }),
});

export const reactionSchema = z.object({
  messageId: z.string().min(1, { message: "Message ID is required." }),
  reaction: z.string().min(1, { message: "Emoji reaction is required." }).max(10),
});

export const readReceiptSchema = z.object({
  conversationId: z.string().min(1, { message: "Conversation ID is required." }),
  messageId: z.string().min(1, { message: "Message ID is required." }),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;
