import Link from "next/link";
import type { CurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";

export function UserCard({ user, collapsed }: { user: CurrentUser; collapsed?: boolean }) {
  return (
    <Link
      href="/profile"
      className={cn(
        "group relative flex items-center gap-2.5 rounded-xl border border-on-primary/20 p-2.5 transition-colors hover:bg-on-primary/10",
        collapsed && "justify-center px-0",
      )}
    >
      <Avatar name={user.name} seed={user.id} />
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <b className="block truncate font-semibold text-on-primary">{user.name}</b>
          <small className="block truncate text-xs text-on-primary/70">{user.title}</small>
        </div>
      )}
      {collapsed && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-full ml-2 z-20 whitespace-nowrap rounded-md bg-text px-2 py-1 text-xs text-bg opacity-0 shadow-pop transition-opacity group-hover:opacity-100"
        >
          {user.name} · Profile
        </span>
      )}
    </Link>
  );
}
