"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMatterChatAccess, canEditMatter } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { extractMentionIds, previewText } from "@/lib/mentions";
import { CLOSED_CHAT_MESSAGE, checkCanDeleteMessage, isMatterChatReadOnly } from "@/lib/chat/rules";
import { MESSAGE_INCLUDE, getMentionableUsers, loadMessagePage, serializeMessage, type MessagePage } from "@/lib/chat/messages";
import { chatMessageUrl } from "@/lib/notifications/links";
import { encryptFile, sha256Hex } from "@/lib/documents/encryption";
import { putObject } from "@/lib/documents/storage";
import { scanBuffer } from "@/lib/documents/virus-scan";
import { detectFileType } from "@/lib/documents/file-signatures";
import { chatEventBus } from "@/lib/chat/event-bus";
import {
  MAX_CHAT_ATTACHMENT_BYTES,
  postCaseMessageSchema,
  togglePinMessageSchema,
  deleteCaseMessageSchema,
  loadEarlierSchema,
} from "@/lib/validation/case-chat";

export type ActionResult<T = unknown> = {
  error?: string;
  data?: T;
};

export type SerializedChatAttachment = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  isLinkedDocument: boolean;
  documentId?: string | null;
  downloadUrl: string;
};

export type SerializedChatMessage = {
  id: string;
  matterId: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  isPinned: boolean;
  pinnedAt: string | null;
  pinnedById: string | null;
  pinnedByName: string | null;
  deletedAt: string | null;
  attachments: SerializedChatAttachment[];
  mentions: { userId: string; userName: string }[];
};

export async function postCaseMessage(formData: FormData): Promise<ActionResult<SerializedChatMessage>> {
  const matterId = String(formData.get("matterId") ?? "");
  const body = String(formData.get("body") ?? "");
  const attachedDocIdsRaw = formData.get("attachedDocumentIds");

  let attachedDocumentIds: string[] = [];
  try {
    if (attachedDocIdsRaw) attachedDocumentIds = JSON.parse(String(attachedDocIdsRaw));
  } catch {
    attachedDocumentIds = [];
  }

  // Note: any "mentionedUserIds" a client sends is ignored — mentions are derived from the
  // message text below and checked against who can actually open this chat.
  const parsed = postCaseMessageSchema.safeParse({
    matterId,
    body,
    attachedDocumentIds,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid message submission." };
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (!body.trim() && files.length === 0 && attachedDocumentIds.length === 0) {
    return { error: "Write a message or attach a file." };
  }

  const user = await requireMatterChatAccess(matterId);
  const matter = await db.matter.findUnique({
    where: { id: matterId },
    select: { id: true, title: true, reference: true, status: true, organizationId: true },
  });

  if (!matter) return { error: "Case not found." };
  if (isMatterChatReadOnly(matter.status)) return { error: CLOSED_CHAT_MESSAGE };

  // Only people who can open this chat can be mentioned (assigned lawyers + the org's Admins).
  const mentionable = await getMentionableUsers(matterId, matter.organizationId);
  const mentionableIds = new Set(mentionable.map((u) => u.id));
  const mentionedUserIds = extractMentionIds(body).filter((id) => mentionableIds.has(id));

  // Process uploaded files (envelope encryption + ClamAV scan)
  const preparedDirectUploads: {
    name: string;
    size: number;
    mimeType: string;
    storageKey: string;
    sha256: string;
    encryptedDataKey: string;
    iv: string;
    authTag: string;
    scanStatus: "CLEAN";
    scanDetail: string | null;
  }[] = [];

  for (const file of files) {
    if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
      return { error: `File "${file.name}" exceeds the 25MB limit.` };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detected = detectFileType(buffer);
    if (!detected) {
      return { error: `File "${file.name}" has an unsupported format. Upload PDF, Office documents, text, images, or a voice note.` };
    }

    const scan = await scanBuffer(buffer);
    if (scan.status === "INFECTED") {
      await writeAudit({
        userId: user.id,
        action: "chat.attachment.infected",
        entity: "Matter",
        entityId: matterId,
        after: { name: file.name, detail: scan.detail },
      });
      return { error: `File "${file.name}" was flagged by the virus scanner and cannot be uploaded.` };
    }
    if (scan.status === "ERROR") {
      return { error: `Could not scan "${file.name}". Upload was not accepted.` };
    }

    const sha256 = sha256Hex(buffer);
    const encrypted = encryptFile(buffer);
    const storageKey = `matters/${matterId}/chat/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    await putObject(storageKey, encrypted.ciphertext);

    preparedDirectUploads.push({
      name: file.name,
      size: buffer.length,
      mimeType: detected.mimeType,
      storageKey,
      sha256,
      encryptedDataKey: encrypted.encryptedDataKey,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      scanStatus: "CLEAN",
      scanDetail: scan.detail ?? null,
    });
  }

  // Validate linked case documents
  const linkedDocuments =
    attachedDocumentIds.length > 0
      ? await db.document.findMany({
          where: { id: { in: attachedDocumentIds }, matterId, deletedAt: null },
          include: { currentVersion: true },
        })
      : [];

  // Database transaction: create message, attachments, mentions
  const result = await db.$transaction(async (tx) => {
    const message = await tx.matterMessage.create({
      data: {
        matterId,
        authorId: user.id,
        body: body.trim(),
      },
    });

    // Create direct upload attachments
    for (const upload of preparedDirectUploads) {
      await tx.matterMessageAttachment.create({
        data: {
          messageId: message.id,
          name: upload.name,
          size: upload.size,
          mimeType: upload.mimeType,
          storageKey: upload.storageKey,
          sha256: upload.sha256,
          encryptedDataKey: upload.encryptedDataKey,
          iv: upload.iv,
          authTag: upload.authTag,
          scanStatus: upload.scanStatus,
          scanDetail: upload.scanDetail,
        },
      });
    }

    // Create linked document attachments
    for (const doc of linkedDocuments) {
      await tx.matterMessageAttachment.create({
        data: {
          messageId: message.id,
          name: doc.name,
          size: doc.currentVersion?.size ?? 0,
          mimeType: doc.currentVersion?.mimeType ?? "application/octet-stream",
          documentId: doc.id,
        },
      });
    }

    // Create mentions
    if (mentionedUserIds.length > 0) {
      await tx.matterMessageMention.createMany({
        data: mentionedUserIds.map((userId) => ({ messageId: message.id, userId })),
      });
    }

    await tx.matter.update({
      where: { id: matterId },
      data: { lastActivityAt: new Date() },
    });

    return message;
  });

  // Write audit log
  await writeAudit({
    userId: user.id,
    action: "message.post",
    entity: "MatterMessage",
    entityId: result.id,
    after: {
      matterId,
      attachmentsCount: preparedDirectUploads.length + linkedDocuments.length,
      mentionsCount: mentionedUserIds.length,
    },
  });

  // Send notifications to mentioned users
  if (mentionedUserIds.length > 0) {
    const notifyTargets = mentionedUserIds.filter((id) => id !== user.id);
    for (const targetId of notifyTargets) {
      await notify({
        userId: targetId,
        type: "MESSAGE_MENTION",
        matterId,
        subject: `Mentioned in ${matter.reference}`,
        message: `${user.name} mentioned you in ${matter.title}: "${previewText(body, 120)}"`,
        url: chatMessageUrl(matterId, result.id),
        payload: { matterId, messageId: result.id },
      });
    }
  }

  // Fetch full serialized message to return & broadcast
  const serialized = serializeMessage(
    await db.matterMessage.findUniqueOrThrow({ where: { id: result.id }, include: MESSAGE_INCLUDE }),
  );

  // Broadcast to active SSE clients
  chatEventBus.publish({
    type: "message.created",
    matterId,
    data: serialized,
  });

  revalidatePath(`/cases/${matterId}`);
  revalidatePath("/chat");
  return { data: serialized };
}

export async function togglePinCaseMessage(raw: unknown): Promise<ActionResult> {
  const parsed = togglePinMessageSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid pin request." };

  const { matterId, messageId, isPinned } = parsed.data;
  const user = await requireMatterChatAccess(matterId);

  const pinMatter = await db.matter.findUnique({ where: { id: matterId }, select: { status: true } });
  if (!pinMatter) return { error: "Case not found." };
  if (isMatterChatReadOnly(pinMatter.status)) return { error: CLOSED_CHAT_MESSAGE };

  const canPin = await canEditMatter(user.id, user.role, matterId);
  if (!canPin) {
    return { error: "Only the lead lawyer or an administrator can pin messages." };
  }

  const updated = await db.matterMessage.update({
    where: { id: messageId, matterId },
    data: {
      isPinned,
      pinnedAt: isPinned ? new Date() : null,
      pinnedById: isPinned ? user.id : null,
    },
    include: { pinnedBy: { select: { name: true } } },
  });

  await writeAudit({
    userId: user.id,
    action: isPinned ? "message.pin" : "message.unpin",
    entity: "MatterMessage",
    entityId: messageId,
    after: { matterId, isPinned },
  });

  chatEventBus.publish({
    type: "message.pinned",
    matterId,
    data: {
      messageId,
      isPinned,
      pinnedAt: updated.pinnedAt?.toISOString() ?? null,
      pinnedById: updated.pinnedById,
      pinnedByName: updated.pinnedBy?.name ?? null,
    },
  });

  revalidatePath(`/cases/${matterId}`);
  revalidatePath("/chat");
  return {};
}

export async function deleteCaseMessage(raw: unknown): Promise<ActionResult> {
  const parsed = deleteCaseMessageSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid delete request." };

  const { matterId, messageId } = parsed.data;
  const user = await requireMatterChatAccess(matterId);

  const message = await db.matterMessage.findUnique({
    where: { id: messageId, matterId },
  });

  if (!message || message.deletedAt) {
    return { error: "Message not found." };
  }

  const deleteMatter = await db.matter.findUnique({ where: { id: matterId }, select: { status: true } });
  if (!deleteMatter) return { error: "Case not found." };

  // Author within the edit window, or an Admin (moderation) — never once the matter is closed.
  const allowed = checkCanDeleteMessage({
    isAuthor: message.authorId === user.id,
    isAdmin: user.role === "ADMIN",
    createdAt: message.createdAt,
    matterStatus: deleteMatter.status,
  });
  if (!allowed.ok) return { error: allowed.error };

  await db.matterMessage.update({
    where: { id: messageId },
    data: {
      deletedAt: new Date(),
      deletedById: user.id,
    },
  });

  await writeAudit({
    userId: user.id,
    action: "message.delete",
    entity: "MatterMessage",
    entityId: messageId,
    after: { matterId },
  });

  chatEventBus.publish({
    type: "message.deleted",
    matterId,
    data: { messageId },
  });

  revalidatePath(`/cases/${matterId}`);
  revalidatePath("/chat");
  return {};
}

/** Older history for the "Load earlier messages" button — same access rule as reading the chat. */
export async function loadEarlierCaseMessages(raw: unknown): Promise<ActionResult<MessagePage>> {
  const parsed = loadEarlierSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid request." };
  const { matterId, before } = parsed.data;
  await requireMatterChatAccess(matterId);
  return { data: await loadMessagePage(matterId, new Date(before)) };
}
