import prisma from "./prisma";
import { ConversationType, MemberRole } from "@prisma/client";

export async function getUserConversations(userId: string) {
  // Fetch all conversations where user is a member
  const conversations = await prisma.conversation.findMany({
    where: {
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              bio: true,
              lastSeen: true,
            },
          },
        },
      },
      messages: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  // Calculate unread counts efficiently
  const enrichedConversations = await Promise.all(
    conversations.map(async (conv) => {
      // Count messages not sent by current user and where current user has no read receipt
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: conv.id,
          senderId: { not: userId },
          deletedAt: null,
          readReceipts: {
            none: {
              userId,
            },
          },
        },
      });

      return {
        ...conv,
        lastMessage: conv.messages[0] || null,
        unreadCount,
      };
    })
  );

  return enrichedConversations;
}

export async function getConversationById(conversationId: string, userId: string) {
  // Verify membership
  const member = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
  });

  if (!member) {
    return null;
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              bio: true,
              lastSeen: true,
            },
          },
        },
        orderBy: {
          joinedAt: "asc",
        },
      },
    },
  });

  return conversation;
}

export async function getOrCreateDirectConversation(userId1: string, userId2: string) {
  if (userId1 === userId2) {
    throw new Error("Cannot create a direct conversation with yourself.");
  }

  // Find existing direct conversation with both members
  const existingConversations = await prisma.conversation.findMany({
    where: {
      type: ConversationType.DIRECT,
      AND: [
        { members: { some: { userId: userId1 } } },
        { members: { some: { userId: userId2 } } },
      ],
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              bio: true,
              lastSeen: true,
            },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  // Filter exact 2-member match
  const directMatch = existingConversations.find((c) => c.members.length === 2);
  if (directMatch) {
    return directMatch;
  }

  // Otherwise, create a new direct conversation
  const newConversation = await prisma.conversation.create({
    data: {
      type: ConversationType.DIRECT,
      members: {
        create: [
          { userId: userId1, role: MemberRole.MEMBER },
          { userId: userId2, role: MemberRole.MEMBER },
        ],
      },
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              bio: true,
              lastSeen: true,
            },
          },
        },
      },
      messages: true,
    },
  });

  return newConversation;
}

export async function createGroupConversation(
  creatorId: string,
  name: string,
  memberIds: string[],
  avatar?: string | null
) {
  // Combine creator and unique members
  const uniqueMemberIds = Array.from(new Set([...memberIds, creatorId]));

  const conversation = await prisma.conversation.create({
    data: {
      type: ConversationType.GROUP,
      name,
      avatar,
      members: {
        create: uniqueMemberIds.map((userId) => ({
          userId,
          role: userId === creatorId ? MemberRole.ADMIN : MemberRole.MEMBER,
        })),
      },
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              bio: true,
              lastSeen: true,
            },
          },
        },
      },
      messages: true,
    },
  });

  return conversation;
}

export async function deleteConversation(conversationId: string, userId: string) {
  // 1. Verify user is member of conversation
  const member = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
  });

  if (!member) {
    throw new Error("Conversation not found or access denied");
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { members: true },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // If GROUP conversation, only ADMIN can delete the entire conversation.
  if (conversation.type === ConversationType.GROUP && member.role !== MemberRole.ADMIN) {
    throw new Error("Only group administrators can delete this group");
  }

  const memberIds = conversation.members.map((m) => m.userId);

  // Clean up messages, reactions, read receipts, members, and conversation
  const messages = await prisma.message.findMany({
    where: { conversationId },
    select: { id: true },
  });
  const messageIds = messages.map((m) => m.id);

  if (messageIds.length > 0) {
    await prisma.messageReaction.deleteMany({
      where: { messageId: { in: messageIds } },
    });
    await prisma.readReceipt.deleteMany({
      where: { messageId: { in: messageIds } },
    });
    await prisma.message.deleteMany({
      where: { conversationId },
    });
  }

  await prisma.conversationMember.deleteMany({
    where: { conversationId },
  });

  await prisma.conversation.delete({
    where: { id: conversationId },
  });

  return { conversationId, memberIds };
}
