import { auth, signOut } from "@/lib/auth";
import Link from "next/link";

export async function Navbar() {
  const session = await auth();

  return (
    <nav className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
      <Link href="/practice" className="text-lg font-bold text-gray-900">
        EchoVocis
      </Link>

      {session?.user && (
        <div className="flex items-center gap-4">
          <Link
            href="/exercises"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Exercises
          </Link>
          <Link
            href="/progress"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Progress
          </Link>
          <Link
            href="/settings"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Settings
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </nav>
  );
}
