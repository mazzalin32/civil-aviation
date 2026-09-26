import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="m-0 mb-1 text-lg font-semibold">Sign in</h1>
      <p className="m-0 mb-5 text-[13px] text-text-muted">Use the email and password the Head of Legal set up for you.</p>
      <LoginForm next={next && next.startsWith("/") ? next : "/"} />
      <p className="m-0 mt-5 text-center text-[13px] text-text-muted">
        <Link href="/forgot-password" className="text-primary hover:underline">
          Forgot your password?
        </Link>
      </p>
    </>
  );
}
