import { Download, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { LOCKOUT_MINUTES, MAX_FAILED_ATTEMPTS } from "@/lib/lockout";
import { getMassDownloadPolicy } from "@/lib/security/activity";
import { MassDownloadForm } from "./mass-download-form";

export const metadata = { title: "Security settings" };

export default async function SecuritySettingsPage() {
  await requireRole("ADMIN");
  const policy = await getMassDownloadPolicy();

  return (
    <>
      <PageHeader title="Security" />
      <div className="flex max-w-3xl flex-col gap-5">
        <Card>
          <CardHeader>
            <Download className="size-4 text-text-muted" />
            <CardTitle>Unusual downloads</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="m-0 text-[13.5px] text-text-muted">
              Every Admin is alerted in the app and by email when one person opens or downloads this many different files in a short time — case
              documents, contract documents and chat attachments all count. One alert per person per window.
            </p>
            <MassDownloadForm policy={policy} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <KeyRound className="size-4 text-text-muted" />
            <CardTitle>Failed sign-ins</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="m-0 text-[13.5px] text-text-muted">
              After {MAX_FAILED_ATTEMPTS} wrong passwords in a row an account is locked for {LOCKOUT_MINUTES} minutes, and every Admin of your
              organisation is alerted in the app and by email.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
