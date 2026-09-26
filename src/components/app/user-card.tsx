import Link from "next/link";
import type { CurrentUser } from "@/lib/session";
import { Avatar } from "./avatar";

export function UserCard({ user }: { user: CurrentUser }) {
  return (
    <Link
      href="/profile"
      className="flex items-center gap-2.5 rounded-xl border border-border p-2.5 transition-colors hover:bg-surface-muted"
    >
      <Avatar name={user.name} seed={user.id} />
      <div className="min-w-0 leading-tight">
        <b className="block truncate font-semibold">{user.name}</b>
        <small className="block truncate text-xs text-text-muted">{user.title}</small>
      </div>
    </Link>
  );
}
