import { TwoFactorForm } from "./two-factor-form";

export const metadata = { title: "Verify your identity" };

export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="m-0 mb-1 text-lg font-semibold">Enter your code</h1>
      <p className="m-0 mb-5 text-[13px] text-text-muted">Open your authenticator app and enter the 6-digit code.</p>
      <TwoFactorForm next={next && next.startsWith("/") ? next : "/"} />
    </>
  );
}
