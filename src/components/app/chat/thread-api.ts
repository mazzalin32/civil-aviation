import {
  deleteCaseMessage,
  editCaseMessage,
  loadEarlierCaseMessages,
  markCaseChatRead,
  postCaseMessage,
  togglePinCaseMessage,
  type ActionResult,
  type SerializedChatMessage,
} from "@/app/(app)/cases/[id]/tabs/discussion-actions";
import {
  deleteDepartmentMessage,
  editDepartmentMessage,
  loadEarlierDepartmentMessages,
  markDepartmentChatRead,
  postDepartmentMessage,
} from "@/app/(app)/chat/department-actions";
import type { MessagePage } from "@/lib/chat/messages";

/** What the composer hands over to be sent. */
export type OutgoingMessage = {
  body: string;
  replyToId: string | null;
  files: File[];
  linkedDocIds: string[];
};

/**
 * Everything a chat thread does on the server, as one object, so the same thread and composer code
 * runs for a case discussion and for the department channel. Build one with `useMemo` (it must be stable).
 */
export type ThreadApi = {
  /** Server-sent events for this thread. */
  streamUrl: string;
  post: (msg: OutgoingMessage) => Promise<ActionResult<SerializedChatMessage>>;
  edit: (messageId: string, body: string) => Promise<ActionResult<SerializedChatMessage>>;
  remove: (messageId: string) => Promise<ActionResult>;
  loadEarlier: (before: string) => Promise<ActionResult<MessagePage>>;
  markRead: () => Promise<ActionResult>;
  /** Pinning exists for case threads only. */
  pin?: (messageId: string, isPinned: boolean) => Promise<ActionResult>;
};

export function caseThreadApi(matterId: string): ThreadApi {
  return {
    streamUrl: `/api/cases/${matterId}/chat/stream`,
    post: ({ body, replyToId, files, linkedDocIds }) => {
      const fd = new FormData();
      fd.append("matterId", matterId);
      fd.append("body", body);
      if (linkedDocIds.length > 0) fd.append("attachedDocumentIds", JSON.stringify(linkedDocIds));
      if (replyToId) fd.append("replyToId", replyToId);
      for (const file of files) fd.append("files", file);
      return postCaseMessage(fd);
    },
    edit: (messageId, body) => editCaseMessage({ matterId, messageId, body }),
    remove: (messageId) => deleteCaseMessage({ matterId, messageId }),
    loadEarlier: (before) => loadEarlierCaseMessages({ matterId, before }),
    markRead: () => markCaseChatRead(matterId),
    pin: (messageId, isPinned) => togglePinCaseMessage({ matterId, messageId, isPinned }),
  };
}

export function departmentThreadApi(): ThreadApi {
  return {
    streamUrl: "/api/chat/department/stream",
    post: ({ body, replyToId }) => postDepartmentMessage({ body, replyToId }),
    edit: (messageId, body) => editDepartmentMessage({ messageId, body }),
    remove: (messageId) => deleteDepartmentMessage({ messageId }),
    loadEarlier: (before) => loadEarlierDepartmentMessages({ before }),
    markRead: () => markDepartmentChatRead(),
  };
}
