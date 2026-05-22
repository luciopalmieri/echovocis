import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { targetLanguage: true },
  });

  const dbSession = await db.session.create({
    data: {
      userId: session.user.id,
      targetLanguage: user?.targetLanguage ?? "en",
    },
  });

  const response = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.XAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expires_after: { seconds: env.SESSION_TTL_SECONDS },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Failed to create ephemeral token:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: response.status }
    );
  }

  const data = await response.json();
  return NextResponse.json({ ...data, sessionId: dbSession.id });
}
