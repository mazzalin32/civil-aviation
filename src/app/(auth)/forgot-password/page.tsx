import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="m-0 mb-1 text-lg font-semibold">Reset your password</h1>
      <p className="m-0 mb-5 text-[13px] text-text-muted">Enter your work email and we&apos;ll send you a link to set a new password.</p>
      <ForgotPasswordForm />
      <p className="m-0 mt-5 text-center text-[13px] text-text-muted">
        <Link href="/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
