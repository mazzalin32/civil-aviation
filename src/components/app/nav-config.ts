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
  | "settings"
  | "contracts"
  | "org";

export type NavSection = "Workspace" | "Library" | "Collaborate" | "Insights" | "Administration";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Groups the sidebar into short, labelled clusters instead of one long flat list. */
  section: NavSection;
  /** A "+" next to the link, for jumping straight to adding one without visiting the list first. */
  quickAdd?: { href: string; label: string };
  /** Small numeric badge (e.g. open tasks assigned to the current user) — filled in at render time. */
  badgeKey?: "openTasks" | "unreadChat";
};

const SHARED: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", section: "Workspace" },
  { href: "/cases", label: "Matters", icon: "cases", section: "Workspace" },
  { href: "/contracts", label: "Contracts", icon: "contracts", section: "Workspace" },
  { href: "/calendar", label: "Calendar", icon: "calendar", section: "Workspace" },
  { href: "/tasks", label: "Tasks", icon: "tasks", badgeKey: "openTasks", section: "Workspace" },
  { href: "/documents", label: "Documents", icon: "documents", section: "Library" },
  { href: "/law-firms", label: "Law Firms", icon: "firms", section: "Library" },
  { href: "/links", label: "Resources", icon: "links", section: "Library" },
  { href: "/chat", label: "Chat", icon: "chat", badgeKey: "unreadChat", section: "Collaborate" },
  { href: "/reports", label: "Reports", icon: "reports", section: "Insights" },
];

/** Sidebar navigation per role, grouped into short labelled sections (the whole org sees the
 *  same data, so sections are about scanability, not permissions); Admin gets one extra
 *  "Administration" section appended at the end. */
export const NAV: Record<Role, NavItem[]> = {
  LAWYER: SHARED,
  ADMIN: [
    ...SHARED.map((item) =>
      item.href === "/cases"
        ? { ...item, quickAdd: { href: "/cases/new", label: "New Matter" } }
        : item.href === "/contracts"
          ? { ...item, quickAdd: { href: "/contracts/new", label: "New contract" } }
          : item,
    ),
    { href: "/closure-requests", label: "Closures", icon: "closure", section: "Administration" },
    { href: "/users", label: "Users & Access", icon: "users", section: "Administration", quickAdd: { href: "/users?new=1", label: "Add lawyer" } },
    { href: "/settings", label: "Settings", icon: "settings", section: "Administration" },
  ],
  // Platform-level: manages organisations and their Admins, not any one org's legal work.
  SUPERADMIN: [{ href: "/superadmin", label: "Organisations", icon: "org", section: "Workspace", quickAdd: { href: "/superadmin/new", label: "New organisation" } }],
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
