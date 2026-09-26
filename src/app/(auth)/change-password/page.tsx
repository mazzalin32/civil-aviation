import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { ChangePasswordForm } from "./change-password-form";

export const metadata = { title: "Change your password" };

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <h1 className="m-0 mb-1 text-lg font-semibold">Set a new password</h1>
      <p className="m-0 mb-5 text-[13px] text-text-muted">
        {user.mustChangePassword
          ? "You're using a temporary password. Choose a new one to continue."
          : "Choose a new password for your account."}
      </p>
      <ChangePasswordForm />
    </>
  );
}
