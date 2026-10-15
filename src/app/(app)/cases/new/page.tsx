import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { WizardForm } from "./wizard-form";
import { loadDraft, getAssignableLawyers } from "./actions";

export const metadata = { title: "New Matter" };

export default async function NewCasePage() {
  await requireRole("ADMIN");

  const [categories, matterTypes, forums, lawyers, folders, draft] = await Promise.all([
    db.category.findMany({ where: { isActive: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.matterType.findMany({
      // Contract matters have their own short intake at /contracts/new instead of this
      // 9-step litigation-oriented wizard (most of its steps don't apply to a contract).
      where: { isActive: true, isSubProcess: false, name: { not: "Contract" } },
      orderBy: { order: "asc" },
      select: { id: true, name: true, referencePrefix: true, stages: { where: { isActive: true }, orderBy: { order: "asc" }, select: { id: true, name: true } } },
    }),
    db.forum.findMany({ where: { isActive: true }, orderBy: { order: "asc" }, select: { id: true, name: true, level: true, division: true } }),
    getAssignableLawyers(),
    db.documentFolder.findMany({ where: { isActive: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    loadDraft(),
  ]);

  return (
    <WizardForm categories={categories} matterTypes={matterTypes} forums={forums} lawyers={lawyers} folders={folders} initialDraft={draft} />
  );
}
