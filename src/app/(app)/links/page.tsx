import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/app/page-header";
import { LinksView } from "./links-view";

export const metadata = { title: "Links" };

export default async function LinksPage() {
  const user = await requireRole();

  const links = await db.resourceLink.findMany({
    include: { addedBy: { select: { name: true } } },
    orderBy: [{ category: "asc" }, { title: "asc" }],
  });

  return (
    <>
      <PageHeader title="Resources" />
      <LinksView isAdmin={user.role === "ADMIN"} links={links.map((l) => ({ id: l.id, title: l.title, url: l.url, category: l.category, addedByName: l.addedBy.name }))} />
    </>
  );
}
