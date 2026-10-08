import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/auth-actions";
import { cn } from "@/lib/utils";

export function SignOutButton({ collapsed }: { collapsed?: boolean }) {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className={cn(
          "group relative flex w-full items-center gap-2 rounded-control px-2.5 py-2 text-[13px] font-medium text-on-primary/75 hover:bg-on-primary/10 hover:text-on-primary",
          collapsed && "justify-center px-0",
        )}
      >
        <LogOut className="size-4 shrink-0" strokeWidth={1.8} />
        {!collapsed && "Sign Out"}
        {collapsed && (
          <span
            role="tooltip"
            className="pointer-events-none absolute left-full ml-2 z-20 whitespace-nowrap rounded-md bg-text px-2 py-1 text-xs text-bg opacity-0 shadow-pop transition-opacity group-hover:opacity-100"
          >
            Sign Out
          </span>
        )}
      </button>
    </form>
  );
}
