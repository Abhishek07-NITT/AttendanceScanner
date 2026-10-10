import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";

export async function GET(req) {
  const sessionId =
    req.headers.get("x-session-id") ||
    req.cookies.get("tf_session")?.value;

  if (sessionId && verifySession(sessionId)) {
    return NextResponse.json({ valid: true, sessionId });
  }

  return NextResponse.json({ valid: false, error: "Invalid session" }, { status: 401 });
}

export async function POST(req) {
  let bodySessionId = null;
  try {
    const body = await req.json();
    bodySessionId = body?.sessionId;
  } catch {
    // ignore
  }

  const sessionId =
    bodySessionId ||
    req.headers.get("x-session-id") ||
    req.cookies.get("tf_session")?.value;

  if (sessionId && verifySession(sessionId)) {
    return NextResponse.json({ valid: true, sessionId });
  }

  return NextResponse.json({ valid: false, error: "Invalid session" }, { status: 401 });
}

