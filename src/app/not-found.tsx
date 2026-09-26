import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="grid max-w-md justify-items-center gap-3 text-center">
        <p className="m-0 text-[13px] font-medium text-text-muted">404</p>
        <h1 className="m-0 font-serif text-[28px] font-semibold">Page not found</h1>
        <p className="m-0 text-text-muted">The link may be out of date, or the page was moved.</p>
        <Link href="/" className={buttonVariants({ variant: "primary" })}>
          Go to your dashboard
        </Link>
      </div>
    </main>
  );
}
