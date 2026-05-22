import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function ProgressPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    redirect("/login");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const progress = await db.progress.findMany({
    where: {
      userId: user.id,
      targetLanguage: user.targetLanguage,
      date: { gte: thirtyDaysAgo },
    },
    orderBy: { date: "desc" },
  });

  const currentStreak = progress.length > 0 ? progress[0].streakDays : 0;

  const totals = progress.reduce(
    (acc, p) => ({
      sentencesSpoken: acc.sentencesSpoken + p.sentencesSpoken,
      mistakesCount: acc.mistakesCount + p.mistakesCount,
      correctionsAccepted: acc.correctionsAccepted + p.correctionsAccepted,
    }),
    { sentencesSpoken: 0, mistakesCount: 0, correctionsAccepted: 0 }
  );

  const totalSessions = await db.session.count({
    where: { userId: user.id },
  });

  const totalMistakes = await db.mistake.count({
    where: { userId: user.id, targetLanguage: user.targetLanguage },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Progress</h1>

      <div className="mb-8 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <div className="text-3xl font-bold text-orange-500">{currentStreak}</div>
          <div className="text-sm text-gray-500">Day streak</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{totalSessions}</div>
          <div className="text-sm text-gray-500">Sessions</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{totals.sentencesSpoken}</div>
          <div className="text-sm text-gray-500">Sentences spoken (30d)</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <div className="text-3xl font-bold text-purple-600">{totalMistakes}</div>
          <div className="text-sm text-gray-500">Mistakes tracked</div>
        </div>
      </div>

      {progress.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 py-12 text-center">
          <p className="text-gray-500">No activity yet.</p>
          <p className="mt-1 text-sm text-gray-400">
            Start a conversation with Emma to see your progress.
          </p>
          <Link
            href="/practice"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Start practicing
          </Link>
        </div>
      ) : (
        <div>
          <h2 className="mb-3 text-lg font-medium text-gray-900">Last 30 days</h2>
          <div className="space-y-2">
            {progress.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3"
              >
                <span className="text-sm text-gray-600">
                  {p.date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>{p.sentencesSpoken} sentences</span>
                  <span>{p.mistakesCount} mistakes</span>
                  <span>{p.correctionsAccepted} corrections</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
