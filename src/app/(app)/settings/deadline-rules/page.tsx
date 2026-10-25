import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/app/page-header";
import { ReferenceTable, type FieldSpec, type ReferenceItem } from "@/components/app/reference-table";
import { AddReferenceButton } from "@/components/app/add-reference-button";
import { createDeadlineRule, deleteDeadlineRule, toggleDeadlineRuleActive, updateDeadlineRule } from "./actions";

export const metadata = { title: "Deadline rules" };

export default async function DeadlineRulesPage() {
  await requireRole("ADMIN");
  const [rules, eventTypes] = await Promise.all([
    db.deadlineRule.findMany({ include: { triggerEventType: true }, orderBy: { title: "asc" } }),
    db.eventType.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }),
  ]);

  const fields: FieldSpec[] = [
    { key: "triggerEventTypeId", label: "Trigger event", type: "select", options: eventTypes.map((t) => ({ value: t.id, label: t.name })) },
    { key: "offsetDays", label: "Days after trigger", type: "text", placeholder: "e.g. 14" },
    {
      key: "isCritical",
      label: "Critical",
      type: "select",
      options: [
        { value: "false", label: "No" },
        { value: "true", label: "Yes" },
      ],
    },
  ];

  const items: ReferenceItem[] = rules.map((r) => ({
    id: r.id,
    name: r.title,
    isActive: r.isActive,
    extra: { triggerEventTypeId: r.triggerEventTypeId, offsetDays: String(r.offsetDays), isCritical: String(r.isCritical) },
  }));

  return (
    <>
      <PageHeader
        title="Deadline rules"
        actions={<AddReferenceButton label="Add deadline rule" panelTitle="Add deadline rule" fields={fields} createAction={createDeadlineRule} />}
      />
      <ReferenceTable items={items} fields={fields} updateAction={updateDeadlineRule} toggleActiveAction={toggleDeadlineRuleActive} deleteAction={deleteDeadlineRule} />
    </>
  );
}
