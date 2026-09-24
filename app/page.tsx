import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserConversations } from "@/lib/db/conversations";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { ConversationWithDetails, UserSummary } from "@/types";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ c?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const selectedConversationId = resolvedParams?.c || null;

  let initialConversations: ConversationWithDetails[] = [];
  try {
    const rawConversations = await getUserConversations(user.id);
    // Serialize Dates to JSON-safe formats
    initialConversations = JSON.parse(JSON.stringify(rawConversations));
  } catch (error) {
    console.error("[Home Page] Error loading user conversations:", error);
    initialConversations = [];
  }

  const serializedUser: UserSummary = {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    bio: user.bio,
    lastSeen: user.lastSeen ? user.lastSeen.toISOString() : null,
  };

  return (
    <main className="h-screen w-screen overflow-hidden">
      <ChatContainer
        initialUser={serializedUser}
        initialConversations={initialConversations}
        initialSelectedId={selectedConversationId}
      />
    </main>
  );
}
