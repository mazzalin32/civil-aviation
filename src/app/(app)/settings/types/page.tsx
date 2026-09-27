import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/app/page-header";
import { AddReferenceButton } from "@/components/app/add-reference-button";
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
          <div className="mb-3 flex items-center justify-between">
            <h2 className="m-0 text-sm font-semibold">Timeline event types</h2>
            <AddReferenceButton label="Add event type" panelTitle="Add event type" createAction={createEventType} />
          </div>
          <ReferenceTable
            items={eventTypes.map((e) => ({ id: e.id, name: e.name, isActive: e.isActive, extra: {} }))}
            updateAction={updateEventType}
            toggleActiveAction={toggleEventTypeActive}
            deleteAction={deleteEventType}
            moveAction={moveEventType}
          />
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="m-0 text-sm font-semibold">Document folders</h2>
            <AddReferenceButton label="Add folder" panelTitle="Add document folder" createAction={createDocumentFolder} />
          </div>
          <ReferenceTable
            items={folders.map((f) => ({ id: f.id, name: f.name, isActive: f.isActive, extra: {} }))}
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
