import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function ExercisesPage() {
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

  const exercises = await db.exercise.findMany({
    where: {
      userId: user.id,
      ...(user.targetLanguage ? { targetLanguage: user.targetLanguage } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      basedOnMistakes: {
        select: { id: true, original: true, corrected: true },
      },
    },
  });

  const pendingCount = exercises.filter((e) => !e.completed).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Exercises</h1>
        <span className="text-sm text-gray-500">
          {pendingCount} pending
        </span>
      </div>

      {exercises.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 py-12 text-center">
          <p className="text-gray-500">No exercises yet.</p>
          <p className="mt-1 text-sm text-gray-400">
            Talk with Emma and she&apos;ll create exercises based on your mistakes.
          </p>
          <Link
            href="/practice"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Start practicing
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {exercises.map((exercise) => (
            <div
              key={exercise.id}
              className={`rounded-lg border p-4 ${
                exercise.completed
                  ? "border-green-200 bg-green-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-medium uppercase tracking-wide ${
                    exercise.completed ? "text-green-600" : "text-blue-600"
                  }`}
                >
                  {exercise.type}
                </span>
                {exercise.completed && (
                  <span className="text-xs text-green-600">Completed</span>
                )}
              </div>

              <p className="mt-2 text-sm text-gray-700">{exercise.content}</p>

              {exercise.basedOnMistakes.length > 0 && (
                <div className="mt-2 text-xs text-gray-400">
                  Based on:{" "}
                  {exercise.basedOnMistakes
                    .map((m) => `"${m.original}" → "${m.corrected}"`)
                    .join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
