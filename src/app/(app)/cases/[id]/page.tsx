import { notFound } from "next/navigation";
import { CalendarClock, ListChecks, MessagesSquare } from "lucide-react";
import { db } from "@/lib/db";
import { requireMatterAccess } from "@/lib/authz";
import { EmptyState } from "@/components/app/empty-state";
import { CaseHeader } from "./header";
import { LifecycleTracker, type TrackerStage } from "./lifecycle-tracker";
import { CatchUpPanel } from "./catch-up-panel";
import { TabStrip, type TabKey } from "./tabs/tab-strip";
import { TimelineTab } from "./tabs/timeline-tab";
import { PartiesTab } from "./tabs/parties-tab";
import { NotesTab } from "./tabs/notes-tab";
import { ActivityTab } from "./tabs/activity-tab";
import { DocumentsTab } from "./tabs/documents-tab";

export const metadata = { title: "Case" };

export default async function CasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const me = await requireMatterAccess(id);
  const sp = await searchParams;
  const tab = (typeof sp.tab === "string" ? sp.tab : "timeline") as TabKey;
  const isAdmin = me.role === "ADMIN";

  const matter = await db.matter.findUnique({
    where: { id },
    include: {
      category: true,
      matterType: { include: { stages: { where: { isActive: true }, orderBy: { order: "asc" } } } },
      currentStage: true,
      forum: true,
      assignments: { where: { removedAt: null }, include: { user: { select: { id: true, name: true } } } },
      parties: { orderBy: { name: "asc" } },
    },
  });
  if (!matter) notFound();

  const [stageMoves, events, latestSummary, summaryVersionIds, notesRaw, lawyers] = await Promise.all([
    db.matterStage.findMany({ where: { matterId: id }, orderBy: { enteredAt: "asc" } }),
    db.event.findMany({ where: { matterId: id }, include: { type: true, createdBy: { select: { name: true } } }, orderBy: { date: "desc" } }),
    db.summaryVersion.findFirst({ where: { matterId: id }, orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } }),
    db.summaryVersion.findMany({ where: { matterId: id }, select: { id: true } }),
    db.note.findMany({
      where: { matterId: id, OR: [{ isPrivate: false }, { authorId: me.id }, ...(isAdmin ? [{ isPrivate: true }] : [])] },
      include: { author: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.user.findMany({
      where: { role: "LAWYER", isActive: true },
      select: { id: true, name: true, title: true, _count: { select: { matterAssignments: { where: { removedAt: null, matter: { status: { in: ["OPEN", "ON_HOLD"] } } } } } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const eventTypes = await db.eventType.findMany({ where: { isActive: true }, orderBy: { order: "asc" } });
  const [documentsRaw, folders] = await Promise.all([
    db.document.findMany({
      where: { matterId: id },
      include: { folder: true, uploadedBy: { select: { name: true } }, currentVersion: true, _count: { select: { versions: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.documentFolder.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }),
  ]);

  let activity: { id: string; action: string; createdAt: Date; before: unknown; after: unknown; user: { name: string } | null }[] = [];
  if (tab === "activity") {
    const eventIds = events.map((e) => e.id);
    const partyIds = matter.parties.map((p) => p.id);
    const noteIds = notesRaw.map((n) => n.id);
    const documentIds = documentsRaw.map((d) => d.id);
    activity = await db.auditLog.findMany({
      where: {
        entity: { in: ["Matter", "Event", "Note", "Party", "SummaryVersion", "Document"] },
        entityId: { in: [id, ...eventIds, ...partyIds, ...noteIds, ...summaryVersionIds.map((s) => s.id), ...documentIds] },
      },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  const team = matter.assignments.map((a) => ({ id: a.user.id, name: a.user.name, role: a.role }));
  // A Server Component render is already tied to one request — "now" is legitimately
  // request-time here, not a hook needing to be stable across client re-renders.
  // eslint-disable-next-line react-hooks/purity
  const daysOpen = Math.max(1, Math.ceil((Date.now() - matter.createdAt.getTime()) / 86_400_000));

  const stages: TrackerStage[] = matter.matterType.stages.map((st) => {
    const move = stageMoves.find((m) => m.stageTemplateId === st.id);
    const status: TrackerStage["status"] = st.id === matter.currentStageId ? "current" : move ? "done" : "future";
    const windowEvents = move
      ? events.filter((e) => e.date >= move.enteredAt && (move.exitedAt ? e.date < move.exitedAt : true))
      : [];
    return {
      id: st.id,
      name: st.name,
      status,
      enteredAt: move ? move.enteredAt.toISOString() : null,
      exitedAt: move?.exitedAt ? move.exitedAt.toISOString() : null,
      events: windowEvents.map((e) => ({ id: e.id, title: e.title, description: e.description, date: e.date.toISOString() })),
    };
  });

  return (
    <>
      <CaseHeader
        data={{
          id: matter.id,
          reference: matter.reference,
          title: matter.title,
          status: matter.status,
          priority: matter.priority,
          confidentiality: matter.confidentiality,
          courtCaseNo: matter.courtCaseNo,
          eccmisNo: matter.eccmisNo,
          forumName: matter.forum?.name ?? null,
          team,
          isAdmin,
          eventTypes: eventTypes.map((t) => ({ id: t.id, name: t.name })),
          stages: matter.matterType.stages.map((s) => ({ id: s.id, name: s.name, order: s.order, requiredFields: s.requiredFields })),
          currentStageId: matter.currentStageId,
          lawyers: lawyers.map((l) => ({ id: l.id, name: l.name, title: l.title, workload: l._count.matterAssignments })),
        }}
      />

      <div className="mb-6">
        <LifecycleTracker matterTypeName={matter.matterType.name} categoryName={matter.category.name} stages={stages} daysOpen={daysOpen} />
      </div>

      <div className="mb-6">
        <CatchUpPanel
          matterId={matter.id}
          summary={latestSummary ? { body: latestSummary.body, authorName: latestSummary.author.name, createdAt: latestSummary.createdAt.toISOString() } : null}
          facts={{
            amountClaimed: matter.amountClaimed !== null ? matter.amountClaimed.toString() : null,
            ucaaRole: matter.ucaaRole,
            judge: matter.judge,
            opposingCounsel: matter.parties.find((p) => p.kind === "OPPOSING")?.counselFirm ?? matter.parties.find((p) => p.kind === "OPPOSING")?.counselName ?? null,
            categoryName: matter.category.name,
            lastActivityAt: matter.lastActivityAt.toISOString(),
          }}
          team={team}
        />
      </div>

      <TabStrip
        matterId={matter.id}
        active={tab}
        counts={{
          timeline: events.length,
          documents: documentsRaw.filter((d) => !d.deletedAt).length,
          parties: matter.parties.length,
          notes: notesRaw.length,
          activity: tab === "activity" ? activity.length : undefined,
        }}
      />

      {tab === "timeline" && (
        <TimelineTab
          events={events.map((e) => ({ id: e.id, title: e.title, description: e.description, date: e.date.toISOString(), typeName: e.type.name, createdByName: e.createdBy.name }))}
          typeNames={eventTypes.map((t) => t.name)}
        />
      )}
      {tab === "parties" && <PartiesTab matterId={matter.id} parties={matter.parties} />}
      {tab === "notes" && (
        <NotesTab
          matterId={matter.id}
          notes={notesRaw.map((n) => ({ id: n.id, body: n.body, isPrivate: n.isPrivate, authorId: n.author.id, authorName: n.author.name, updatedAt: n.updatedAt.toISOString() }))}
          currentUserId={me.id}
        />
      )}
      {tab === "activity" && (
        <ActivityTab
          entries={activity.map((a) => ({ id: a.id, action: a.action, by: a.user?.name ?? "System", at: a.createdAt.toISOString(), before: a.before, after: a.after }))}
          isAdmin={isAdmin}
        />
      )}
      {tab === "documents" && (
        <DocumentsTab
          matterId={matter.id}
          folders={folders.map((f) => ({ id: f.id, name: f.name }))}
          events={events.map((e) => ({ id: e.id, title: e.title }))}
          matterConfidentiality={matter.confidentiality}
          isAdmin={isAdmin}
          documents={documentsRaw.map((d) => ({
            id: d.id,
            name: d.name,
            folderId: d.folderId,
            folderName: d.folder.name,
            tags: d.tags,
            confidentiality: d.confidentiality,
            currentVersionId: d.currentVersionId,
            versionCount: d._count.versions,
            size: d.currentVersion?.size ?? null,
            uploadedByName: d.uploadedBy.name,
            uploadedAt: d.currentVersion?.uploadedAt.toISOString() ?? null,
            deletedAt: d.deletedAt ? d.deletedAt.toISOString() : null,
          }))}
        />
      )}
      {tab === "hearings" && <EmptyState icon={CalendarClock} title="Hearings & deadlines" description="Calendar, hearing outcomes and deadline tracking arrive in Phase 7." />}
      {tab === "tasks" && <EmptyState icon={ListChecks} title="Tasks" description="Checklist items with assignees and due dates arrive in Phase 7." />}
      {tab === "discussion" && <EmptyState icon={MessagesSquare} title="Discussion" description="The per-case chat thread arrives in Phase 9." />}
    </>
  );
}
