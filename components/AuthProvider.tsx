"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onIdTokenChanged, signOut as firebaseSignOut, type User } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase-client";

type AuthState = { user: User | null; loading: boolean };

const AuthContext = createContext<AuthState>({ user: null, loading: true });

// Tracks the signed-in Firebase user in the browser (name, photo, uid for cursors and the header).
// The server never trusts this: it reads the httpOnly session cookie instead (see lib/auth.ts).
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(
    () => onIdTokenChanged(firebaseAuth, (user) => setState({ user, loading: false })),
    []
  );

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useUser() {
  return useContext(AuthContext);
}

// Signs out of Firebase in the browser and clears the server session cookie.
export async function signOut() {
  await Promise.all([firebaseSignOut(firebaseAuth), fetch("/api/session", { method: "DELETE" })]);
}
