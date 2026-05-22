import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { LanguageFlag, SUPPORTED_LANGUAGES } from "@/components/LanguageFlag";

export default async function SettingsPage() {
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

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Settings</h1>

      <form
        className="space-y-6"
        action={async (formData: FormData) => {
          "use server";
          const session = await auth();
          if (!session?.user?.id) return;

          const nativeLanguage = formData.get("nativeLanguage") as string;
          const targetLanguage = formData.get("targetLanguage") as string;

          await db.user.update({
            where: { id: session.user.id },
            data: { nativeLanguage, targetLanguage },
          });

          redirect("/settings");
        }}
      >
        <div className="rounded-lg border border-gray-200 p-4">
          <h2 className="mb-4 text-lg font-medium text-gray-900">Languages</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Native language
              </label>
              <select
                name="nativeLanguage"
                defaultValue={user.nativeLanguage}
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
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Target language
              </label>
              <select
                name="targetLanguage"
                defaultValue={user.targetLanguage}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                {SUPPORTED_LANGUAGES.map((code) => (
                  <option key={code} value={code}>
                    {new Intl.DisplayNames(["en"], { type: "language" }).of(code)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 p-4">
          <h2 className="mb-2 text-lg font-medium text-gray-900">Profile</h2>
          <p className="text-sm text-gray-500">
            {user.name || "No name set"} &middot; {user.email}
          </p>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          Save changes
        </button>
      </form>
    </div>
  );
}
