import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { VoiceConversation } from "@/components/voice/VoiceConversation";

export default async function PracticePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.onboardingCompleted) {
    redirect("/onboarding");
  }

  const sessionCount = await db.session.count({
    where: { userId: user.id },
  });

  const recentMistakes = await db.mistake.findMany({
    where: {
      userId: user.id,
      targetLanguage: user.targetLanguage,
    },
    orderBy: { lastSeenAt: "desc" },
    take: 10,
    select: {
      original: true,
      corrected: true,
      type: true,
    },
  });

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
        <h2 className="text-sm font-medium text-gray-600">
          Practice: {user.targetLanguage.toUpperCase()}
        </h2>
        <span className="text-xs text-gray-400">
          {recentMistakes.length > 0
            ? `${recentMistakes.length} recent mistakes loaded`
            : "No previous mistakes"}
        </span>
      </div>

      <VoiceConversation
        nativeLanguage={user.nativeLanguage}
        targetLanguage={user.targetLanguage}
        recentMistakes={recentMistakes}
        sessionCount={sessionCount}
      />
    </div>
  );
}
