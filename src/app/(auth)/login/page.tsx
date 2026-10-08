import Link from "next/link";
import { LoginForm } from "./login-form";
import { demoLoginPassword } from "@/lib/demo-login";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const demoPassword = demoLoginPassword();
  return (
    <>
      <h1 className="m-0 mb-1 text-center font-serif text-[26px] leading-tight font-semibold text-text">
        Welcome to CAA Legal
        <br />
        Case File Management
      </h1>
      <p className="m-0 mb-6 text-center text-lg font-semibold text-primary">Sign in</p>
      <LoginForm next={next && next.startsWith("/") ? next : "/"} />
      {demoPassword && (
        <p className="m-0 mt-4 rounded-control bg-primary-soft px-3 py-2 text-center text-[13px] text-primary">
          Prototype password: <span className="font-semibold tabular-nums">{demoPassword}</span>
        </p>
      )}
      <p className="m-0 mt-5 text-center text-[13px] text-text-muted">
        <Link href="/forgot-password" className="text-primary hover:underline">
          Forgot your password?
        </Link>
      </p>
    </>
  );
}
