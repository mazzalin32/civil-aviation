import type { Role } from "@/lib/session";

export type NavIcon =
  | "dashboard"
  | "cases"
  | "calendar"
  | "tasks"
  | "documents"
  | "firms"
  | "chat"
  | "links"
  | "reports"
  | "closure"
  | "users"
  | "settings";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** A "+" next to the link, for jumping straight to adding one without visiting the list first. */
  quickAdd?: { href: string; label: string };
  /** Small numeric badge (e.g. open tasks assigned to the current user) — filled in at render time. */
  badgeKey?: "openTasks";
};

const SHARED: NavItem[] = [
  { href: "/dashboard", label: "Legal Dashboard", icon: "dashboard" },
  { href: "/cases", label: "Legal Matters", icon: "cases" },
  { href: "/calendar", label: "Legal Calendar", icon: "calendar" },
  { href: "/tasks", label: "Tasks & Legal Deadlines", icon: "tasks", badgeKey: "openTasks" },
  { href: "/documents", label: "Legal Documents", icon: "documents" },
  { href: "/law-firms", label: "External Counsel & Law Firms", icon: "firms" },
  { href: "/links", label: "Legal Resources & Links", icon: "links" },
  { href: "/chat", label: "Matter Chat", icon: "chat" },
  { href: "/reports", label: "Legal Reports & Analytics", icon: "reports" },
];

/** Sidebar navigation per role — one flat list, no section headers (the whole org sees the
 *  same data); Admin gets a few extra items appended at the end. */
export const NAV: Record<Role, NavItem[]> = {
  LAWYER: SHARED,
  ADMIN: [
    ...SHARED.map((item) => (item.href === "/cases" ? { ...item, quickAdd: { href: "/cases/new", label: "New Matter" } } : item)),
    { href: "/closure-requests", label: "Matter Closure Requests", icon: "closure" },
    { href: "/users", label: "Users & Access", icon: "users", quickAdd: { href: "/users?new=1", label: "Add lawyer" } },
    { href: "/settings", label: "Legal System Settings", icon: "settings" },
  ],
};

export function homePathFor(role: Role) {
  return NAV[role][0]?.href ?? "/dashboard";
}

/** Page title for the top bar, derived from the nav so it never drifts. */
export function titleFor(pathname: string, role: Role) {
  if (pathname.startsWith("/profile")) return "Profile & preferences";
  const item = NAV[role].find((n) => pathname === n.href || pathname.startsWith(n.href + "/"));
  return item?.label ?? "";
}
