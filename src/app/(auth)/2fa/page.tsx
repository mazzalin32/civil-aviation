import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { TwoFactorForm } from "./two-factor-form";

export const metadata = { title: "Verify your identity" };

export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;

  // Fire the first code the moment this page loads — one less click than a "Send code" button.
  let sendError: string | null = null;
  try {
    await auth.api.sendTwoFactorOTP({ headers: await headers(), asResponse: false });
  } catch {
    sendError = "Couldn't send a code. Use the resend link below once you're ready.";
  }

  return (
    <>
      <h1 className="m-0 mb-1 text-lg font-semibold">Enter your code</h1>
      <p className="m-0 mb-5 text-[13px] text-text-muted">{sendError ?? "We've emailed a 6-digit code to your inbox."}</p>
      <TwoFactorForm next={next && next.startsWith("/") ? next : "/"} />
    </>
  );
}
