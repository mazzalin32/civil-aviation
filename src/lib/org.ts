import "server-only";

/**
 * Every query against org-owned data (Matter, Contract, and anything joined through them)
 * must be scoped to the signed-in user's own organisation — never another one's, and never
 * "all of them" by accident. `CurrentUser.organizationId` is only ever null for Superadmin,
 * who never reaches an organisation-scoped page; this sentinel makes that case fail closed
 * (matches zero rows) instead of silently falling back to no filter at all.
 */
export function orgId(organizationId: string | null): string {
  return organizationId ?? "__no-organization__";
}
