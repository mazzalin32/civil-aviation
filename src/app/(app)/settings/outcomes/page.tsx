import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/app/page-header";
import { AddReferenceButton } from "@/components/app/add-reference-button";
import { ReferenceTable } from "@/components/app/reference-table";
import { createOutcome, deleteOutcome, moveOutcome, toggleOutcomeActive, updateOutcome } from "./actions";

export const metadata = { title: "Outcomes" };

export default async function OutcomesPage() {
  await requireRole("ADMIN");
  const outcomes = await db.outcome.findMany({ orderBy: { order: "asc" } });

  return (
    <>
      <PageHeader
        title="Outcomes"
        actions={<AddReferenceButton label="Add outcome" panelTitle="Add outcome" createAction={createOutcome} />}
      />
      <ReferenceTable
        items={outcomes.map((o) => ({ id: o.id, name: o.name, isActive: o.isActive, extra: {} }))}
        updateAction={updateOutcome}
        toggleActiveAction={toggleOutcomeActive}
        deleteAction={deleteOutcome}
        moveAction={moveOutcome}
      />
    </>
  );
}
