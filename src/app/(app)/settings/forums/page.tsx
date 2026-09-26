import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/app/page-header";
import { ReferenceTable, type FieldSpec } from "@/components/app/reference-table";
import { createForum, moveForum, toggleForumActive, updateForum } from "./actions";

export const metadata = { title: "Courts & forums" };

const LEVELS = [
  { value: "SUPREME_COURT", label: "Supreme Court" },
  { value: "COURT_OF_APPEAL", label: "Court of Appeal" },
  { value: "CONSTITUTIONAL_COURT", label: "Constitutional Court" },
  { value: "HIGH_COURT", label: "High Court" },
  { value: "CHIEF_MAGISTRATE", label: "Chief Magistrate's Court" },
  { value: "MAGISTRATE_GI", label: "Magistrate Grade I" },
  { value: "TRIBUNAL", label: "Tribunal" },
  { value: "ARBITRATION", label: "Arbitration" },
  { value: "INTERNAL_PANEL", label: "Internal panel" },
];

const fields: FieldSpec[] = [
  { key: "level", label: "Level", type: "select", options: LEVELS },
  { key: "division", label: "Division", type: "text", placeholder: "e.g. Commercial Division" },
  { key: "location", label: "Location", type: "text", placeholder: "e.g. Kampala" },
];

export default async function ForumsPage() {
  await requireRole("ADMIN");
  const forums = await db.forum.findMany({ orderBy: { order: "asc" } });

  return (
    <>
      <PageHeader title="Courts & forums" description="The Court/Forum dropdown in the case wizard and forum tab." />
      <ReferenceTable
        items={forums.map((f) => ({
          id: f.id,
          name: f.name,
          isActive: f.isActive,
          extra: { level: f.level, division: f.division ?? "", location: f.location ?? "" },
        }))}
        fields={fields}
        addLabel="Add court / forum"
        createAction={createForum}
        updateAction={updateForum}
        toggleActiveAction={toggleForumActive}
        moveAction={moveForum}
      />
    </>
  );
}
