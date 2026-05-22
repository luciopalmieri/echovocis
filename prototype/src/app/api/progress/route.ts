import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { sentencesSpoken, mistakesCount, correctionsAccepted, targetLanguage } = body;

  if (!targetLanguage) {
    return NextResponse.json(
      { error: "Missing required field: targetLanguage" },
      { status: 400 }
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const hadActivityYesterday = await db.progress.findFirst({
    where: {
      userId: session.user.id,
      targetLanguage,
      date: yesterday,
    },
  });

  const streakDays = hadActivityYesterday ? hadActivityYesterday.streakDays + 1 : 1;

  const progress = await db.progress.upsert({
    where: {
      userId_targetLanguage_date: {
        userId: session.user.id,
        targetLanguage,
        date: today,
      },
    },
    create: {
      userId: session.user.id,
      targetLanguage,
      date: today,
      sentencesSpoken: sentencesSpoken || 0,
      mistakesCount: mistakesCount || 0,
      correctionsAccepted: correctionsAccepted || 0,
      streakDays,
    },
    update: {
      sentencesSpoken: { increment: sentencesSpoken || 0 },
      mistakesCount: { increment: mistakesCount || 0 },
      correctionsAccepted: { increment: correctionsAccepted || 0 },
      streakDays,
    },
  });

  return NextResponse.json(progress);
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetLanguage = searchParams.get("targetLanguage");
  const days = parseInt(searchParams.get("days") || "30", 10);

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const progress = await db.progress.findMany({
    where: {
      userId: session.user.id,
      ...(targetLanguage ? { targetLanguage } : {}),
      date: { gte: since },
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

  return NextResponse.json({
    progress,
    currentStreak,
    totals,
    daysTracked: progress.length,
  });
}
