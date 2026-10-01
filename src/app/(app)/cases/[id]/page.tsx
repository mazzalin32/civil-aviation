import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { db } from "@/lib/db";
import { requireMatterAccess, canEditMatter, canAssignTasks, canAccessMatterChat } from "@/lib/authz";
import { CaseHeader } from "./header";
import { LifecycleTracker, type TrackerStage } from "./lifecycle-tracker";
import { CatchUpPanel } from "./catch-up-panel";
import { TabStrip, type TabKey } from "./tabs/tab-strip";
import { TimelineTab } from "./tabs/timeline-tab";
import { NotesTab } from "./tabs/notes-tab";
import { ActivityTab } from "./tabs/activity-tab";
import { DocumentsTab } from "./tabs/documents-tab";
import { HearingsTab, type HearingRow } from "./tabs/hearings-tab";
import { TasksTab } from "./tabs/tasks-tab";
import { DiscussionTab } from "./tabs/discussion-tab";

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
  const canEdit = await canEditMatter(me.id, me.role, id);
  const canAssign = await canAssignTasks(me.id, me.role, id);
  const canChat = await canAccessMatterChat(me.id, me.role, id);

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

  const [stageMoves, events, latestSummary, summaryVersionIds, notesRaw, lawyers, messages] = await Promise.all([
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
    db.matterMessage.findMany({
      where: { matterId: id },
      include: {
        author: { select: { id: true, name: true } },
        pinnedBy: { select: { id: true, name: true } },
        attachments: true,
        mentions: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const eventTypes = await db.eventType.findMany({ where: { isActive: true }, orderBy: { order: "asc" } });
  const [documentsRaw, folders, calendarEntries, tasksRaw, forums] = await Promise.all([
    db.document.findMany({
      where: { matterId: id },
      include: { folder: true, uploadedBy: { select: { name: true } }, currentVersion: true, _count: { select: { versions: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.documentFolder.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }),
    db.calendarEntry.findMany({ where: { matterId: id }, orderBy: { startsAt: "desc" } }),
    db.task.findMany({ where: { matterId: id }, include: { assignee: { select: { name: true } } }, orderBy: { dueAt: "asc" } }),
    db.forum.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }),
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

  const latestPinnedMessage = messages
    .filter((m) => m.isPinned && !m.deletedAt)
    .sort((a, b) => (b.pinnedAt?.getTime() ?? b.createdAt.getTime()) - (a.pinnedAt?.getTime() ?? a.createdAt.getTime()))[0] ?? null;

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
          canMutate: canEdit,
          eventTypes: eventTypes.map((t) => ({ id: t.id, name: t.name })),
          stages: matter.matterType.stages.map((s) => ({ id: s.id, name: s.name, order: s.order, requiredFields: s.requiredFields })),
          currentStageId: matter.currentStageId,
          lawyers: lawyers.map((l) => ({ id: l.id, name: l.name, title: l.title, workload: l._count.matterAssignments })),
          forums: forums.map((f) => ({ id: f.id, name: f.name })),
        }}
      />

      <div className="mb-6">
        <LifecycleTracker matterTypeName={matter.matterType.name} categoryName={matter.category.name} stages={stages} daysOpen={daysOpen} />
      </div>

      <div className="mb-6">
        <CatchUpPanel
          matterId={matter.id}
          summary={latestSummary ? { body: latestSummary.body, authorName: latestSummary.author.name, createdAt: latestSummary.createdAt.toISOString() } : null}
          pinnedMessage={latestPinnedMessage ? {
            body: latestPinnedMessage.body,
            authorName: latestPinnedMessage.author.name,
            createdAt: (latestPinnedMessage.pinnedAt ?? latestPinnedMessage.createdAt).toISOString(),
          } : null}
          facts={{
            amountClaimed: matter.amountClaimed !== null ? matter.amountClaimed.toString() : null,
            ucaaRole: matter.ucaaRole,
            judge: matter.judge,
            opposingCounsel: matter.parties.find((p) => p.kind === "OPPOSING")?.counselFirm ?? matter.parties.find((p) => p.kind === "OPPOSING")?.counselName ?? null,
            categoryName: matter.category.name,
            lastActivityAt: matter.lastActivityAt.toISOString(),
          }}
          team={team}
          canMutate={canEdit}
          deadlines={calendarEntries
            .filter((e) => e.kind === "DEADLINE" && e.status === "OPEN")
            .slice()
            .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
            .slice(0, 4)
            .map((e) => ({ id: e.id, title: e.title, dueAt: e.startsAt.toISOString(), isCritical: e.isCritical }))}
        />
      </div>

      <TabStrip
        matterId={matter.id}
        active={tab}
        counts={{
          timeline: events.length,
          documents: documentsRaw.filter((d) => !d.deletedAt).length,
          hearings: calendarEntries.filter((e) => e.kind === "DEADLINE").length,
          tasks: tasksRaw.length,
          discussion: messages.filter((m) => !m.deletedAt).length,
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
      {tab === "notes" && (
        <NotesTab
          matterId={matter.id}
          notes={notesRaw.map((n) => ({ id: n.id, body: n.body, isPrivate: n.isPrivate, authorId: n.author.id, authorName: n.author.name, updatedAt: n.updatedAt.toISOString() }))}
          currentUserId={me.id}
          canMutate={canEdit}
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
          canUpload
          canMutate={canEdit}
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
      {tab === "hearings" && (
        <HearingsTab
          canMutate={isAdmin}
          entries={calendarEntries
            .filter((e) => e.kind === "DEADLINE")
            .map((e) => ({
            id: e.id,
            kind: e.kind as HearingRow["kind"],
            title: e.title,
            startsAt: e.startsAt.toISOString(),
            status: e.status,
            outcomeType: e.outcomeType,
            outcomeNote: e.outcomeNote,
            isCritical: e.isCritical,
            courtroom: e.courtroom,
            purpose: e.purpose,
          }))}
        />
      )}
      {tab === "tasks" && (
        <TasksTab
          matterId={matter.id}
          currentUserId={me.id}
          canMutate={canAssign}
          teamMembers={lawyers.map((l) => ({ id: l.id, name: l.name }))}
          tasks={tasksRaw.map((t) => ({
            id: t.id,
            title: t.title,
            assigneeId: t.assigneeId,
            assigneeName: t.assignee.name,
            dueAt: t.dueAt.toISOString(),
            doneAt: t.doneAt ? t.doneAt.toISOString() : null,
            status: t.status,
            naReason: t.naReason,
          }))}
        />
      )}
      {tab === "discussion" && !canChat && (
        <div className="rounded-card border border-border bg-surface p-10 text-center shadow-card">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-surface-muted text-text-muted">
            <Lock className="size-5" />
          </div>
          <h3 className="m-0 text-base font-semibold text-text">Case Discussion Restricted</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">
            Case communications are restricted to legal counsel assigned to this matter ({team.map((t) => t.name).join(", ") || "No lawyers assigned"}).
          </p>
        </div>
      )}
      {tab === "discussion" && canChat && (
        <DiscussionTab
          matterId={matter.id}
          currentUserId={me.id}
          canPin={canEdit}
          team={team}
          allLawyers={lawyers.map((l) => ({ id: l.id, name: l.name }))}
          caseDocuments={documentsRaw
            .filter((d) => !d.deletedAt)
            .map((d) => ({
              id: d.id,
              name: d.name,
              folderName: d.folder.name,
              size: d.currentVersion?.size ?? null,
            }))}
          messages={messages.map((m) => ({
            id: m.id,
            matterId: m.matterId,
            body: m.body,
            createdAt: m.createdAt.toISOString(),
            authorId: m.author.id,
            authorName: m.author.name,
            isPinned: m.isPinned,
            pinnedAt: m.pinnedAt?.toISOString() ?? null,
            pinnedById: m.pinnedById,
            pinnedByName: m.pinnedBy?.name ?? null,
            deletedAt: m.deletedAt?.toISOString() ?? null,
            attachments: m.attachments.map((att) => ({
              id: att.id,
              name: att.name,
              size: att.size,
              mimeType: att.mimeType,
              isLinkedDocument: Boolean(att.documentId),
              documentId: att.documentId,
              downloadUrl: `/api/cases/${matter.id}/chat/attachments/${att.id}/download`,
            })),
            mentions: m.mentions.map((men) => ({
              userId: men.user.id,
              userName: men.user.name,
            })),
          }))}
        />
      )}
    </>
  );
}
