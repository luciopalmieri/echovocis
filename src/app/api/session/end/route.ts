import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { sessionId } = body;

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing required field: sessionId" },
      { status: 400 }
    );
  }

  const updated = await db.session.update({
    where: { id: sessionId, userId: session.user.id },
    data: { endedAt: new Date() },
  });

  return NextResponse.json(updated);
}
