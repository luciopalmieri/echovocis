import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function LandingPage() {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white to-blue-50 px-4">
      <div className="max-w-lg text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900">
          EchoVocis
        </h1>
        <p className="mb-2 text-xl text-gray-600">
          Learn languages by talking with Emma
        </p>
        <p className="mb-8 text-gray-500">
          A voice-first AI coach that helps you improve spoken fluency through
          real-time conversation, corrections, and personalized exercises.
        </p>

        {session?.user ? (
          <Link
            href="/practice"
            className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Talk with Emma
          </Link>
        ) : (
          <Link
            href="/login"
            className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Get started
          </Link>
        )}
      </div>
    </div>
  );
}
