import { auth } from "./auth";
import prisma from "@/lib/db/prisma";

export async function getCurrentSession() {
  return await auth();
}

export async function getCurrentUser() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        bio: true,
        lastSeen: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  } catch (error) {
    console.error("[Session] Error fetching current user:", error);
    // If DB has temporary connection glitch, fall back to JWT session data
    return {
      id: session.user.id,
      name: session.user.name || "User",
      email: session.user.email || "",
      avatar: session.user.image || null,
      bio: null,
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized: Please sign in to access this resource.");
  }
  return user;
}
