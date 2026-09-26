import Link from "next/link";
import { FormAlert } from "@/components/auth/form-alert";
import { buttonVariants } from "@/components/ui/button";
import { ActivateForm } from "./activate-form";

export const metadata = { title: "Set your password" };

export default async function ActivatePage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;

  if (!token || error) {
    return (
      <>
        <h1 className="m-0 mb-4 text-lg font-semibold">This link is no longer valid</h1>
        <FormAlert>Activation and reset links expire after 72 hours and work only once.</FormAlert>
        <Link href="/forgot-password" className={`${buttonVariants({ variant: "primary" })} mt-5 w-full justify-center`}>
          Request a new link
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="m-0 mb-1 text-lg font-semibold">Set your password</h1>
      <p className="m-0 mb-5 text-[13px] text-text-muted">Choose a password for your CAA Legal account.</p>
      <ActivateForm token={token} />
    </>
  );
}
