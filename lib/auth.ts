import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { adminAuth, SESSION_COOKIE } from "@/lib/firebase-admin";
import { prisma } from "@/lib/prisma";

// The signed-in user for Server Components, Server Actions and API routes, or null.
// Verifies the session cookie with Firebase, then upserts the local User row so name and
// photo stay in sync with Google. cache() runs this once per request, however many callers.
export const getCurrentUser = cache(async () => {
  const sessionCookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;

  let claims;
  try {
    claims = await adminAuth.verifySessionCookie(sessionCookie);
  } catch {
    return null; // expired, tampered with, or from another project
  }
  if (!claims.email) return null;

  const profile = {
    email: claims.email.toLowerCase(),
    name: (claims.name as string | undefined) ?? null,
    imageUrl: claims.picture ?? null,
  };

  return prisma.user.upsert({
    where: { firebaseUid: claims.uid },
    update: profile,
    create: { firebaseUid: claims.uid, ...profile },
  });
});
