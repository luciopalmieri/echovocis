import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const EXERCISE_TYPES = ["drill", "repetition", "translation_prompt", "fluency_booster"];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { type, targetLanguage, basedOnMistakeIds, content } = body;

  if (!type || !targetLanguage) {
    return NextResponse.json(
      { error: "Missing required fields: type, targetLanguage" },
      { status: 400 }
    );
  }

  if (!EXERCISE_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${EXERCISE_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  let mistakes: { id: string }[] = [];

  if (basedOnMistakeIds && basedOnMistakeIds.length > 0) {
    mistakes = basedOnMistakeIds.map((id: string) => ({ id }));
  } else {
    const recentMistakes = await db.mistake.findMany({
      where: {
        userId: session.user.id,
        targetLanguage,
      },
      orderBy: { occurrenceCount: "desc" },
      take: 3,
    });
    mistakes = recentMistakes.map((m) => ({ id: m.id }));
  }

  const exercise = await db.exercise.create({
    data: {
      userId: session.user.id,
      targetLanguage,
      type,
      content: content || `Practice ${type}: review your common mistakes in ${targetLanguage}`,
      basedOnMistakes: {
        connect: mistakes,
      },
    },
    include: {
      basedOnMistakes: {
        select: { id: true, original: true, corrected: true, type: true },
      },
    },
  });

  return NextResponse.json(exercise, { status: 201 });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetLanguage = searchParams.get("targetLanguage");
  const completed = searchParams.get("completed");

  const exercises = await db.exercise.findMany({
    where: {
      userId: session.user.id,
      ...(targetLanguage ? { targetLanguage } : {}),
      ...(completed !== null ? { completed: completed === "true" } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      basedOnMistakes: {
        select: { id: true, original: true, corrected: true },
      },
    },
  });

  return NextResponse.json({ exercises });
}
