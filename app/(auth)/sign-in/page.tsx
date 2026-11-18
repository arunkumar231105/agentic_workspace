import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { GoogleSignInButton } from "./_components/GoogleSignInButton";

// Only same-site paths, so ?redirect= can't send people to another website.
function safeRedirect(value: string | string[] | undefined) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const redirectTo = safeRedirect((await searchParams).redirect);

  // Already signed in: skip the page.
  if (await getCurrentUser()) redirect(redirectTo);

  return (
    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-card/80 p-8 text-center shadow-2xl shadow-black/40">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome to Outpost</h1>
      <p className="mt-2 text-sm text-muted-foreground">Sign in to plan with your team and the agent.</p>
      <GoogleSignInButton redirectTo={redirectTo} />
    </div>
  );
}
