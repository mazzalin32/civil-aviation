import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { WizardForm } from "./wizard-form";
import { loadDraft, getAssignableLawyers } from "./actions";

export const metadata = { title: "New case" };

export default async function NewCasePage() {
  await requireRole("ADMIN");

  const [categories, matterTypes, forums, lawyers, folders, draft] = await Promise.all([
    db.category.findMany({ where: { isActive: true }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.matterType.findMany({
      where: { isActive: true, isSubProcess: false },
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
