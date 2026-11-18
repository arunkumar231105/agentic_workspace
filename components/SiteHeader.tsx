"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut, useUser } from "@/components/AuthProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Shared across every route (root layout). The landing page gets its section links and a way into
// the app; inside the app, the logo leads home to the dashboard.
export function SiteHeader() {
  const pathname = usePathname();
  const { user, loading } = useUser();
  const isLandingPage = pathname === "/";

  return (
    <header className="fixed inset-x-0 top-0 z-20 flex h-18 items-center justify-between border-b border-white/6 bg-background/70 px-6 backdrop-blur-md md:px-10">
      <Link href={user && !isLandingPage ? "/dashboard" : "/"} className="flex items-center">
        <Image src="/brand/logo-navbar-dark.png" alt="Outpost" width={314} height={160} className="h-9 w-auto" priority />
      </Link>
      {isLandingPage && (
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <Link href="#product" className="transition-colors hover:text-foreground">Product</Link>
          <Link href="#how-it-works" className="transition-colors hover:text-foreground">How it works</Link>
        </nav>
      )}
      {/* Nothing until Firebase knows whether someone is signed in, to avoid a flash of the wrong buttons. */}
      {!loading && (
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {isLandingPage ? (
                <Button asChild size="sm">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              ) : (
                <Button asChild size="sm" variant="ghost">
                  <Link href="/workspaces">Workspaces</Link>
                </Button>
              )}
              <UserMenu name={user.displayName} email={user.email} photoURL={user.photoURL} />
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          )}
        </div>
      )}
    </header>
  );
}

function UserMenu({ name, email, photoURL }: { name: string | null; email: string | null; photoURL: string | null }) {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="rounded-full ring-offset-background focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
          <Avatar name={name ?? email ?? "?"} photoURL={photoURL} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{name ?? "Signed in"}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSignOut}>
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Google profile photo, or the first letter of the name if there isn't one.
export function Avatar({ name, photoURL, size = 32 }: { name: string; photoURL: string | null; size?: number }) {
  return photoURL ? (
    <Image src={photoURL} alt={name} width={size} height={size} className="rounded-full" style={{ width: size, height: size }} />
  ) : (
    <span
      className="flex items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary"
      style={{ width: size, height: size }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
