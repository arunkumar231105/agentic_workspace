import { NextResponse, type NextRequest } from "next/server";

// Must match SESSION_COOKIE in lib/firebase-admin.ts (not imported, to keep firebase-admin out
// of the proxy).
const SESSION_COOKIE = "session";

const PROTECTED_PREFIXES = ["/dashboard", "/workspace"]; // also covers /workspaces

// A fast first gate: no session cookie on a protected page means straight to sign-in.
// It only checks that the cookie exists; getCurrentUser (lib/auth.ts) does the real
// verification, and pages redirect to /sign-in themselves if that fails.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !req.cookies.has(SESSION_COOKIE)) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect", pathname + req.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/workspace/:path*", "/workspaces/:path*"],
};
