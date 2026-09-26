import type { Role } from "@/lib/session";

export type NavIcon =
  | "dashboard"
  | "cases"
  | "calendar"
  | "tasks"
  | "closure"
  | "users"
  | "reports"
  | "import"
  | "settings";

export type NavItem = { href: string; label: string; icon: NavIcon };

/** Sidebar navigation per role — PROJECT_SPEC.md §10 "Layout". */
export const NAV: Record<Role, NavItem[]> = {
  LAWYER: [
    { href: "/my-day", label: "My Day", icon: "dashboard" },
    { href: "/cases", label: "My cases", icon: "cases" },
    { href: "/calendar", label: "My calendar", icon: "calendar" },
    { href: "/tasks", label: "Tasks", icon: "tasks" },
  ],
  ADMIN: [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/cases", label: "Cases", icon: "cases" },
    { href: "/calendar", label: "Calendar", icon: "calendar" },
    { href: "/closure-requests", label: "Closure requests", icon: "closure" },
    { href: "/users", label: "Users", icon: "users" },
    { href: "/reports", label: "Reports", icon: "reports" },
    { href: "/import", label: "Import", icon: "import" },
    { href: "/settings", label: "Settings", icon: "settings" },
  ],
};

export function homePathFor(role: Role) {
  return role === "ADMIN" ? "/dashboard" : "/my-day";
}

/** Page title for the top bar, derived from the nav so it never drifts. */
export function titleFor(pathname: string, role: Role) {
  if (pathname.startsWith("/profile")) return "Profile & preferences";
  const item = NAV[role].find((n) => pathname === n.href || pathname.startsWith(n.href + "/"));
  return item?.label ?? "";
}
