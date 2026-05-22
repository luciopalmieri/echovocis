import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  const grokForm = new FormData();
  grokForm.append("file", file);

  const res = await fetch("https://api.x.ai/v1/stt", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.XAI_API_KEY}` },
    body: grokForm,
  });

  if (!res.ok) {
    return NextResponse.json({ error: "STT failed" }, { status: 500 });
  }

  const data = await res.json();
  return NextResponse.json({ text: data.text || "" });
}
