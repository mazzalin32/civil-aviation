import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { db } from "@/lib/db";
import { requireMatterAccess } from "@/lib/authz";
import { CaseHeader } from "./header";
import { LifecycleTracker, type TrackerStage } from "./lifecycle-tracker";
import { CatchUpPanel } from "./catch-up-panel";
import { ContractDetailsCard } from "./contract-details-card";
import { TabStrip, type TabKey } from "./tabs/tab-strip";
import { TimelineTab } from "./tabs/timeline-tab";
import { NotesTab } from "./tabs/notes-tab";
import { ActivityTab } from "./tabs/activity-tab";
import { DocumentsTab } from "./tabs/documents-tab";
import { HearingsTab, type HearingRow } from "./tabs/hearings-tab";
import { TasksTab } from "./tabs/tasks-tab";
import { DiscussionTab } from "./tabs/discussion-tab";
import { UCAA_POSITIONS } from "@/lib/validation/matter";

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

  // Everything is fetched in ONE parallel batch (previously four sequential rounds), and the heavy
  // collections are only loaded for the tab that shows them — other tabs just need a count.
  const needDocuments = tab === "documents" || tab === "discussion";
  const noteWhere = { matterId: id, OR: [{ isPrivate: false }, { authorId: me.id }, ...(isAdmin ? [{ isPrivate: true }] : [])] };
  const [
    matter,
    stageMoves,
    events,
    latestSummary,
    summaryVersionIds,
    lawyers,
    assignablePeople,
    eventTypes,
    calendarEntries,
    tasksRaw,
    forums,
    notesRaw,
    noteCount,
    documentsRaw,
    documentCount,
    folders,
    messages,
    messageCount,
    pinnedMessage,
    contractStatusOptions,
  ] = await Promise.all([
    db.matter.findUnique({
      where: { id },
      include: {
        category: true,
        matterType: { include: { stages: { where: { isActive: true }, orderBy: { order: "asc" } } } },
        currentStage: true,
        forum: true,
        legalRecipient: { select: { name: true } },
        assignments: { where: { removedAt: null }, include: { user: { select: { id: true, name: true } } } },
        parties: { orderBy: { name: "asc" } },
        contractDetail: {
          include: { receiptStatus: true, legalReviewStatus: true, internalApprovalStatus: true, agVettingStatus: true, amendmentsStatus: true },
        },
      },
    }),
    db.matterStage.findMany({ where: { matterId: id }, orderBy: { enteredAt: "asc" } }),
    db.event.findMany({ where: { matterId: id }, include: { type: true, createdBy: { select: { name: true } } }, orderBy: { date: "desc" } }),
    db.summaryVersion.findFirst({ where: { matterId: id }, orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } }),
    tab === "activity" ? db.summaryVersion.findMany({ where: { matterId: id }, select: { id: true } }) : Promise.resolve([] as { id: string }[]),
    db.user.findMany({
      where: { role: "LAWYER", isActive: true },
      select: { id: true, name: true, title: true, _count: { select: { matterAssignments: { where: { removedAt: null, matter: { status: { in: ["OPEN", "ON_HOLD"] } } } } } } },
      orderBy: { name: "asc" },
    }),
    tab === "tasks" ? db.user.findMany({ where: { isActive: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([] as { id: string; name: string }[]),
    db.eventType.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }),
    db.calendarEntry.findMany({ where: { matterId: id }, orderBy: { startsAt: "desc" } }),
    db.task.findMany({ where: { matterId: id }, include: { assignee: { select: { name: true } } }, orderBy: { dueAt: "asc" } }),
    db.forum.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }),
    tab === "notes"
      ? db.note.findMany({ where: noteWhere, include: { author: { select: { id: true, name: true } } }, orderBy: { updatedAt: "desc" } })
      : Promise.resolve([] as { id: string; body: string; isPrivate: boolean; updatedAt: Date; author: { id: string; name: string } }[]),
    db.note.count({ where: noteWhere }),
    needDocuments
      ? db.document.findMany({
          where: { matterId: id },
          include: { folder: true, uploadedBy: { select: { name: true } }, currentVersion: true, _count: { select: { versions: true } } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    db.document.count({ where: { matterId: id, deletedAt: null } }),
    tab === "documents" ? db.documentFolder.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }) : Promise.resolve([] as { id: string; name: string }[]),
    tab === "discussion"
      ? db.matterMessage.findMany({
          where: { matterId: id },
          include: {
            author: { select: { id: true, name: true } },
            pinnedBy: { select: { id: true, name: true } },
            attachments: true,
            mentions: { include: { user: { select: { id: true, name: true } } } },
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    db.matterMessage.count({ where: { matterId: id, deletedAt: null } }),
    db.matterMessage.findFirst({ where: { matterId: id, isPinned: true, deletedAt: null }, orderBy: { pinnedAt: "desc" }, include: { author: { select: { id: true, name: true } } } }),
    db.contractStatusOption.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }),
  ]);
  if (!matter || matter.deletedAt) notFound();

  // Same rules as canEditMatter / canAssignTasks / canAccessMatterChat in authz.ts, derived from the
  // assignments we already loaded instead of three more queries. The actions themselves still enforce them.
  const myAssignment = matter.assignments.find((a) => a.userId === me.id)?.role ?? null;
  const canEdit = isAdmin || myAssignment === "LEAD" || myAssignment === "SUPPORT";
  const canAssign = isAdmin || myAssignment === "LEAD";
  const canChat = isAdmin || myAssignment !== null;

  let activity: { id: string; action: string; createdAt: Date; before: unknown; after: unknown; user: { name: string } | null }[] = [];
  if (tab === "activity") {
    const eventIds = events.map((e) => e.id);
    const partyIds = matter.parties.map((p) => p.id);
    const [noteRows, documentRows] = await Promise.all([
      db.note.findMany({ where: { matterId: id }, select: { id: true } }),
      db.document.findMany({ where: { matterId: id }, select: { id: true } }),
    ]);
    const noteIds = noteRows.map((n) => n.id);
    const documentIds = documentRows.map((d) => d.id);
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
  const nowMs = Date.now();
  const daysOpen = Math.max(1, Math.ceil((nowMs - matter.createdAt.getTime()) / 86_400_000));

  // Stages ordered before the current one count as passed even if no move was recorded (e.g. a case
  // created directly at a later stage), so the tracker never shows "upcoming" behind the current stage.
  const currentOrder = matter.currentStage?.order ?? null;
  const stages: TrackerStage[] = matter.matterType.stages.map((st) => {
    const move = stageMoves.find((m) => m.stageTemplateId === st.id);
    const status: TrackerStage["status"] =
      st.id === matter.currentStageId ? "current" : move || (currentOrder !== null && st.order < currentOrder) ? "done" : "future";
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

  const latestPinnedMessage = pinnedMessage;

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
        <LifecycleTracker matterId={matter.id} matterTypeName={matter.matterType.name} categoryName={matter.category.name} stages={stages} daysOpen={daysOpen} />
      </div>

      <div className="mb-6">
        <CatchUpPanel
          matterId={matter.id}
          snapshot={{
            statusLabel: matter.status.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()),
            priorityLabel: matter.priority[0] + matter.priority.slice(1).toLowerCase(),
            stageName: matter.currentStage?.name ?? null,
            stageIndex: stages.findIndex((s) => s.status === "current") + 1,
            stageTotal: stages.length,
            daysOpen,
            openTasks: tasksRaw.filter((t) => t.status === "OPEN").length,
            overdueTasks: tasksRaw.filter((t) => t.status === "OPEN" && t.dueAt.getTime() < nowMs).length,
            documents: documentCount,
            messages: messageCount,
            nextDeadline: (() => {
              const next = calendarEntries.filter((e) => e.kind === "DEADLINE" && e.status === "OPEN").sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];
              return next ? { title: next.title, dueAt: next.startsAt.toISOString() } : null;
            })(),
          }}
          status={{
            status: matter.status,
            priorityLabel: matter.priority[0] + matter.priority.slice(1).toLowerCase(),
            confidentialityLabel: matter.confidentiality === "NORMAL" ? "Normal" : matter.confidentiality === "CONFIDENTIAL" ? "Confidential" : "Highly confidential",
            stageName: matter.currentStage?.name ?? null,
            stageIndex: stages.findIndex((s) => s.status === "current") + 1,
            stageTotal: stages.length,
            daysOpen,
            nextDeadline: (() => {
              const next = calendarEntries.filter((e) => e.kind === "DEADLINE" && e.status === "OPEN").sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];
              return next ? { title: next.title, dueAt: next.startsAt.toISOString() } : null;
            })(),
          }}
          intake={(() => {
            const main = matter.parties.find((p) => p.kind === "OPPOSING");
            const response = calendarEntries.find((e) => e.kind === "DEADLINE" && e.title.startsWith("Response deadline"));
            return {
              description: matter.description,
              reportedAt: matter.reportedAt?.toISOString() ?? null,
              reportedBy: matter.reportedBy,
              reportMethod: matter.reportMethod,
              positionLabel: UCAA_POSITIONS.find((p) => p.value === matter.ucaaRole)?.label ?? matter.ucaaRole,
              otherParty: main ? { name: main.name, type: main.partyType, contact: main.email ?? main.phone, address: main.address } : null,
              otherParties: matter.parties.filter((p) => p !== main && p.kind !== "INTERNAL").map((p) => ({ name: p.name, role: p.roleInMatter ?? (p.kind === "WITNESS" ? "Witness" : null), organisation: p.organisation })),
              serviceDirection: matter.serviceDirection ? { CAA_SERVING: "CAA is serving", CAA_SERVED: "CAA has been served", NOT_YET_SERVED: "Not yet served" }[matter.serviceDirection] : null,
              processNature: matter.processNature,
              issuedAt: matter.processIssuedAt?.toISOString() ?? null,
              receivedAt: matter.processReceivedAt?.toISOString() ?? null,
              receivedBy: matter.receivedBy,
              recipientName: matter.legalRecipient?.name ?? null,
              responseDeadline: response ? { dueAt: response.startsAt.toISOString(), status: response.status } : null,
              forumName: matter.forum?.name ?? null,
              courtStation: matter.courtStation,
              courtCaseNo: matter.courtCaseNo,
              filedAt: matter.filedAt?.toISOString() ?? null,
              jurisdiction: matter.jurisdiction,
              judge: matter.judge,
              eccmisNo: matter.eccmisNo,
              representationStatus: matter.representationStatus,
              leadName: team.find((t) => t.role === "LEAD")?.name ?? null,
              supportNames: team.filter((t) => t.role === "SUPPORT").map((t) => t.name),
              externalCounselName: matter.externalCounselName,
              externalCounselContact: matter.externalCounselContact,
            };
          })()}
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
          canManageTeam={isAdmin}
          lawyers={lawyers.map((l) => ({ id: l.id, name: l.name, workload: l._count.matterAssignments }))}
          deadlines={calendarEntries
            .filter((e) => e.kind === "DEADLINE" && e.status === "OPEN")
            .slice()
            .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
            .slice(0, 4)
            .map((e) => ({ id: e.id, title: e.title, dueAt: e.startsAt.toISOString(), isCritical: e.isCritical }))}
        />
      </div>

      {matter.matterType.name === "Contract" && (
        <div className="mb-6">
          <ContractDetailsCard
            matterId={matter.id}
            canMutate={canEdit}
            detail={{
              originatingDepartment: matter.contractDetail?.originatingDepartment ?? null,
              dateOfReceipt: matter.contractDetail?.dateOfReceipt?.toISOString() ?? null,
              dateSubmittedForReview: matter.contractDetail?.dateSubmittedForReview?.toISOString() ?? null,
              receiptStatus: matter.contractDetail?.receiptStatus ? { id: matter.contractDetail.receiptStatus.id, label: matter.contractDetail.receiptStatus.label } : null,
              legalReviewStatus: matter.contractDetail?.legalReviewStatus ? { id: matter.contractDetail.legalReviewStatus.id, label: matter.contractDetail.legalReviewStatus.label } : null,
              internalApprovalStatus: matter.contractDetail?.internalApprovalStatus
                ? { id: matter.contractDetail.internalApprovalStatus.id, label: matter.contractDetail.internalApprovalStatus.label }
                : null,
              agVettingStatus: matter.contractDetail?.agVettingStatus ? { id: matter.contractDetail.agVettingStatus.id, label: matter.contractDetail.agVettingStatus.label } : null,
              amendmentsStatus: matter.contractDetail?.amendmentsStatus ? { id: matter.contractDetail.amendmentsStatus.id, label: matter.contractDetail.amendmentsStatus.label } : null,
              caaExecutionStatus: matter.contractDetail?.caaExecutionStatus ?? "PENDING",
              counterpartyExecutionStatus: matter.contractDetail?.counterpartyExecutionStatus ?? "PENDING",
              dateOfSignature: matter.contractDetail?.dateOfSignature?.toISOString() ?? null,
              dateOfFullExecution: matter.contractDetail?.dateOfFullExecution?.toISOString() ?? null,
              commencementDate: matter.contractDetail?.commencementDate?.toISOString() ?? null,
              expiryDate: matter.contractDetail?.expiryDate?.toISOString() ?? null,
              outstandingAction: matter.contractDetail?.outstandingAction ?? null,
            }}
            statusOptions={{
              receipt: contractStatusOptions.filter((o) => o.category === "RECEIPT").map((o) => ({ id: o.id, label: o.label })),
              legalReview: contractStatusOptions.filter((o) => o.category === "LEGAL_REVIEW").map((o) => ({ id: o.id, label: o.label })),
              internalApproval: contractStatusOptions.filter((o) => o.category === "INTERNAL_APPROVAL").map((o) => ({ id: o.id, label: o.label })),
              agVetting: contractStatusOptions.filter((o) => o.category === "AG_VETTING").map((o) => ({ id: o.id, label: o.label })),
              amendments: contractStatusOptions.filter((o) => o.category === "AMENDMENTS").map((o) => ({ id: o.id, label: o.label })),
            }}
          />
        </div>
      )}

      <TabStrip
        matterId={matter.id}
        active={tab}
        counts={{
          timeline: events.length,
          documents: documentCount,
          hearings: calendarEntries.filter((e) => e.kind === "DEADLINE").length,
          tasks: tasksRaw.length,
          discussion: messageCount,
          notes: noteCount,
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
          canMutate={isAdmin}
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
          teamMembers={assignablePeople}
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
