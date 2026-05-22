import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export async function Navbar() {
  const session = await auth();

  let languageLabel = "";
  if (session?.user?.id) {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { nativeLanguage: true, targetLanguage: true, onboardingCompleted: true },
    });
    if (user?.onboardingCompleted) {
      languageLabel = `${user.nativeLanguage.toUpperCase()} \u2192 ${user.targetLanguage.toUpperCase()}`;
    }
  }

  return (
    <nav className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <Link href="/practice" className="text-lg font-bold text-gray-900">
          EchoVocis
        </Link>
        {languageLabel && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {languageLabel}
          </span>
        )}
      </div>

      {session?.user && (
        <div className="flex items-center gap-4">
          <Link href="/exercises" className="text-sm text-gray-600 hover:text-gray-900">
            Exercises
          </Link>
          <Link href="/progress" className="text-sm text-gray-600 hover:text-gray-900">
            Progress
          </Link>
          <Link href="/settings" className="text-sm text-gray-600 hover:text-gray-900">
            Settings
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="text-sm text-gray-500 hover:text-gray-900">
              Sign out
            </button>
          </form>
        </div>
      )}
    </nav>
  );
}
