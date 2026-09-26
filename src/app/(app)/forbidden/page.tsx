import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "No access" };

export default function Forbidden() {
  return (
    <EmptyState
      icon={ShieldAlert}
      title="You don't have access to this page"
      description="This area is for a different role. If you think you need access, ask the Head of Legal."
      action={
        <Link href="/" className={buttonVariants({ variant: "primary" })}>
          Back to your dashboard
        </Link>
      }
    />
  );
}
