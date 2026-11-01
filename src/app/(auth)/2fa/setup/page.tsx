import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { SetupWizard } from "./setup-wizard";

export const metadata = { title: "Set up two-factor authentication" };

export default async function TwoFactorSetupPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.twoFactorEnabled) redirect("/");

  return (
    <>
      <h1 className="m-0 mb-1 text-lg font-semibold">Set up two-factor authentication</h1>
      <p className="m-0 mb-5 text-[13px] text-text-muted">Required for every account. A code is emailed to you each time you sign in.</p>
      <SetupWizard email={user.email} />
    </>
  );
}
