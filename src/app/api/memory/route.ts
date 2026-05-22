import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { original, corrected, type, targetLanguage, sessionId } = body;

  if (!original || !corrected || !type || !targetLanguage) {
    return NextResponse.json(
      { error: "Missing required fields: original, corrected, type, targetLanguage" },
      { status: 400 }
    );
  }

  const validTypes = ["grammar", "vocabulary", "pronunciation", "fluency"];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  const existing = await db.mistake.findFirst({
    where: {
      userId: session.user.id,
      targetLanguage,
      original,
    },
  });

  if (existing) {
    const updated = await db.mistake.update({
      where: { id: existing.id },
      data: {
        corrected,
        type,
        occurrenceCount: { increment: 1 },
        lastSeenAt: new Date(),
        sessionId: sessionId || existing.sessionId,
      },
    });
    return NextResponse.json(updated);
  }

  const mistake = await db.mistake.create({
    data: {
      userId: session.user.id,
      original,
      corrected,
      type,
      targetLanguage,
      sessionId,
    },
  });

  return NextResponse.json(mistake, { status: 201 });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);
  const targetLanguage = searchParams.get("targetLanguage");

  const mistakes = await db.mistake.findMany({
    where: {
      userId: session.user.id,
      ...(targetLanguage ? { targetLanguage } : {}),
    },
    orderBy: { lastSeenAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ mistakes });
}
