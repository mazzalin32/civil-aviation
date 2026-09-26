import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/auth-actions";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="flex w-full items-center gap-2 rounded-control px-2.5 py-2 text-[13px] font-medium text-text-muted hover:bg-surface-muted hover:text-text"
      >
        <LogOut className="size-4" strokeWidth={1.8} />
        Sign out
      </button>
    </form>
  );
}
