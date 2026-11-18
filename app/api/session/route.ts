import { cookies } from "next/headers";
import { adminAuth, SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/firebase-admin";

// POST { idToken }: after Google sign-in, the browser sends its Firebase ID token here.
// We verify it and swap it for a 5-day session cookie the browser can't read (httpOnly).
export async function POST(req: Request) {
  const { idToken } = (await req.json().catch(() => ({}))) as { idToken?: string };
  if (!idToken) return Response.json({ error: "Missing idToken" }, { status: 400 });

  let sessionCookie: string;
  try {
    // Throws if the token is invalid or expired. Also rejects tokens from a sign-in older than
    // 5 minutes, so a stolen old token can't be turned into a session.
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (Date.now() / 1000 - decoded.auth_time > 5 * 60) {
      return Response.json({ error: "Sign in again" }, { status: 401 });
    }
    sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
  } catch {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  (await cookies()).set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true, // not readable from JavaScript
    secure: process.env.NODE_ENV === "production", // localhost is plain http in dev
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000, // seconds
  });
  return Response.json({ ok: true });
}

// DELETE: sign out on the server by removing the cookie.
export async function DELETE() {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
