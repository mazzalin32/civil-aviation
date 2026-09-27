import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/app/page-header";
import { ReferenceTable } from "@/components/app/reference-table";
import {
  createDocumentFolder,
  createEventType,
  deleteDocumentFolder,
  deleteEventType,
  moveDocumentFolder,
  moveEventType,
  toggleDocumentFolderActive,
  toggleEventTypeActive,
  updateDocumentFolder,
  updateEventType,
} from "./actions";

export const metadata = { title: "Event & document types" };

export default async function TypesPage() {
  await requireRole("ADMIN");
  const [eventTypes, folders] = await Promise.all([
    db.eventType.findMany({ orderBy: { order: "asc" } }),
    db.documentFolder.findMany({ orderBy: { order: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Event & document types" description="What can be logged on a case timeline, and the folders documents sort into." />
      <div className="grid gap-8">
        <section>
          <h2 className="mb-3 text-sm font-semibold">Timeline event types</h2>
          <ReferenceTable
            items={eventTypes.map((e) => ({ id: e.id, name: e.name, isActive: e.isActive, extra: {} }))}
            addLabel="Add event type"
            createAction={createEventType}
            updateAction={updateEventType}
            toggleActiveAction={toggleEventTypeActive}
            deleteAction={deleteEventType}
            moveAction={moveEventType}
          />
        </section>
        <section>
          <h2 className="mb-3 text-sm font-semibold">Document folders</h2>
          <ReferenceTable
            items={folders.map((f) => ({ id: f.id, name: f.name, isActive: f.isActive, extra: {} }))}
            addLabel="Add folder"
            createAction={createDocumentFolder}
            updateAction={updateDocumentFolder}
            toggleActiveAction={toggleDocumentFolderActive}
            deleteAction={deleteDocumentFolder}
            moveAction={moveDocumentFolder}
          />
        </section>
      </div>
    </>
  );
}
