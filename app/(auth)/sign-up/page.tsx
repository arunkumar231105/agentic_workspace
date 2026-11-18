import { redirect } from "next/navigation";

// Google sign-in creates the account on first use, so sign-up is the same page.
export default function SignUpPage() {
  redirect("/sign-in");
}
