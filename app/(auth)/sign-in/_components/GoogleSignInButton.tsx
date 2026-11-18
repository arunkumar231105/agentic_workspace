"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup, signOut } from "firebase/auth";
import { toast } from "sonner";
import { firebaseAuth, googleProvider } from "@/lib/firebase-client";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    try {
      // 1. Google popup -> Firebase signs the user in the browser.
      const { user } = await signInWithPopup(firebaseAuth, googleProvider);
      // 2. Send the short-lived ID token to our server, which sets the httpOnly session cookie.
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: await user.getIdToken() }),
      });
      if (!res.ok) throw new Error("Couldn't start your session");
      // 3. Go on to the app; refresh so Server Components re-render with the new cookie.
      router.replace(redirectTo);
      router.refresh();
    } catch (err) {
      // Closing the popup isn't an error worth shouting about.
      const code = (err as { code?: string }).code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        toast.error(err instanceof Error ? err.message : "Sign-in failed");
        await signOut(firebaseAuth); // don't leave the browser half signed in
      }
      setBusy(false);
    }
  };

  return (
    <Button onClick={signIn} disabled={busy} size="lg" className="mt-6 w-full gap-2">
      <GoogleIcon />
      {busy ? "Signing in..." : "Continue with Google"}
    </Button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}
