import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { SUPPORTED_LANGUAGES } from "@/components/LanguageFlag";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (user?.onboardingCompleted) {
    redirect("/practice");
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
          Welcome to EchoVocis!
        </h1>
        <p className="mb-8 text-center text-gray-500">
          Choose your languages to get started
        </p>

        <form className="space-y-6" action={async (formData: FormData) => {
          "use server";
          const session = await auth();
          if (!session?.user?.id) return;

          const nativeLanguage = formData.get("nativeLanguage") as string;
          const targetLanguage = formData.get("targetLanguage") as string;

          await db.user.update({
            where: { id: session.user.id },
            data: {
              nativeLanguage,
              targetLanguage,
              onboardingCompleted: true,
            },
          });

          redirect("/practice");
        }}>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              I speak
            </label>
            <select
              name="nativeLanguage"
              defaultValue="it"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {SUPPORTED_LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {new Intl.DisplayNames(["en"], { type: "language" }).of(code)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              I want to learn
            </label>
            <select
              name="targetLanguage"
              defaultValue="en"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {SUPPORTED_LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {new Intl.DisplayNames(["en"], { type: "language" }).of(code)}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Start learning
          </button>
        </form>
      </div>
    </div>
  );
}
