import prisma from "./prisma";
import { MessageType } from "@prisma/client";

export async function getConversationMessages(
  conversationId: string,
  userId: string,
  options: { cursor?: string; limit?: number } = {}
) {
  const limit = options.limit || 30;

  // Check if user is a member
  const membership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
  });

  if (!membership) {
    throw new Error("Forbidden: You are not a member of this conversation.");
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
    },
    take: limit,
    ...(options.cursor
      ? {
          skip: 1,
          cursor: {
            id: options.cursor,
          },
        }
      : {}),
    orderBy: {
      createdAt: "desc",
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          avatar: true,
          email: true,
        },
      },
      replyTo: {
        select: {
          id: true,
          content: true,
          senderId: true,
          deletedAt: true,
          sender: {
            select: {
              name: true,
            },
          },
        },
      },
      reactions: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      readReceipts: {
        select: {
          id: true,
          userId: true,
          readAt: true,
        },
      },
    },
  });

  // Calculate next cursor
  const nextCursor = messages.length === limit ? messages[messages.length - 1].id : null;

  return {
    messages: messages.reverse(), // Return in chronological order for chat rendering
    nextCursor,
  };
}

export async function createMessage({
  conversationId,
  senderId,
  content,
  type = MessageType.TEXT,
  attachmentUrl,
  attachmentName,
  attachmentSize,
  attachmentType,
  replyToId,
}: {
  conversationId: string;
  senderId: string;
  content?: string;
  type?: MessageType;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
  attachmentType?: string | null;
  replyToId?: string | null;
}) {
  // Check membership
  const membership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: senderId,
      },
    },
  });

  if (!membership) {
    throw new Error("Forbidden: Sender is not a member of this conversation.");
  }

  // Create message and touch conversation updatedAt in a transaction
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId,
        senderId,
        content: content || null,
        type,
        attachmentUrl: attachmentUrl || null,
        attachmentName: attachmentName || null,
        attachmentSize: attachmentSize || null,
        attachmentType: attachmentType || null,
        replyToId: replyToId || null,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatar: true,
            email: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            senderId: true,
            deletedAt: true,
            sender: {
              select: {
                name: true,
              },
            },
          },
        },
        reactions: true,
        readReceipts: true,
      },
    });

    // Touch conversation updated timestamp
    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return created;
  });

  return message;
}

export async function editMessage(messageId: string, userId: string, newContent: string) {
  const existing = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (!existing) {
    throw new Error("Message not found.");
  }

  if (existing.senderId !== userId) {
    throw new Error("Forbidden: You can only edit your own messages.");
  }

  if (existing.deletedAt) {
    throw new Error("Cannot edit a deleted message.");
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: {
      content: newContent,
      editedAt: new Date(),
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          avatar: true,
          email: true,
        },
      },
      replyTo: {
        select: {
          id: true,
          content: true,
          senderId: true,
          deletedAt: true,
          sender: {
            select: {
              name: true,
            },
          },
        },
      },
      reactions: true,
      readReceipts: true,
    },
  });

  return updated;
}

export async function deleteMessage(messageId: string, userId: string) {
  const existing = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (!existing) {
    throw new Error("Message not found.");
  }

  if (existing.senderId !== userId) {
    throw new Error("Forbidden: You can only delete your own messages.");
  }

  // Soft delete: keep the record for reply-threads and audit, blank the content
  const deleted = await prisma.message.update({
    where: { id: messageId },
    data: {
      deletedAt: new Date(),
      content: "This message was deleted",
      attachmentUrl: null,
      attachmentName: null,
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          avatar: true,
          email: true,
        },
      },
      replyTo: {
        select: {
          id: true,
          content: true,
          senderId: true,
          deletedAt: true,
          sender: {
            select: {
              name: true,
            },
          },
        },
      },
      reactions: true,
      readReceipts: true,
    },
  });

  return deleted;
}

export async function toggleMessageReaction(messageId: string, userId: string, reaction: string) {
  // Check if message exists and user is a member of the conversation
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { conversationId: true },
  });

  if (!message) {
    throw new Error("Message not found.");
  }

  const membership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId: message.conversationId,
        userId,
      },
    },
  });

  if (!membership) {
    throw new Error("Forbidden: Not a member of this conversation.");
  }

  // Check if reaction already exists
  const existing = await prisma.messageReaction.findUnique({
    where: {
      messageId_userId_reaction: {
        messageId,
        userId,
        reaction,
      },
    },
  });

  if (existing) {
    await prisma.messageReaction.delete({
      where: { id: existing.id },
    });
    return { action: "removed", reaction };
  } else {
    const created = await prisma.messageReaction.create({
      data: {
        messageId,
        userId,
        reaction,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    return { action: "added", reaction: created };
  }
}

export async function markMessagesAsSeen(conversationId: string, userId: string) {
  // Check membership
  const membership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
  });

  if (!membership) {
    throw new Error("Forbidden: Not a member of this conversation.");
  }

  // Find unread messages not sent by current user
  const unreadMessages = await prisma.message.findMany({
    where: {
      conversationId,
      senderId: { not: userId },
      deletedAt: null,
      readReceipts: {
        none: {
          userId,
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (unreadMessages.length === 0) {
    return { count: 0, messageIds: [] };
  }

  const messageIds = unreadMessages.map((m) => m.id);

  // Bulk create read receipts
  await prisma.readReceipt.createMany({
    data: messageIds.map((msgId) => ({
      messageId: msgId,
      userId,
      readAt: new Date(),
    })),
  });

  return {
    count: messageIds.length,
    messageIds,
  };
}
