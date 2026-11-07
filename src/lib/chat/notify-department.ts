import "server-only";
import { notify } from "../notify";
import { previewText } from "../mentions";
import { chatDepartmentUrl } from "../notifications/links";
import { publishUserEvent } from "../notifications/event-bus";
import { DEPARTMENT_CHANNEL_NAME } from "./channels";

type Input = {
  author: { id: string; name: string };
  message: { id: string; body: string };
  /** Already validated: department members who were @mentioned. */
  mentionedIds: string[];
  replyToAuthorId: string | null;
  /** Everyone in the channel, the author included. */
  memberIds: string[];
};

/**
 * Who hears about a department message, and how loudly. The channel is for the whole organisation, so a
 * bell entry per message would drown people: only @mentions and replies make a bell entry. Everyone else
 * gets a silent "chat-activity" ping that raises their unread badge live and nothing more.
 */
export async function notifyDepartmentActivity({ author, message, mentionedIds, replyToAuthorId, memberIds }: Input) {
  const mentioned = new Set(mentionedIds.filter((id) => id !== author.id));
  const replyTarget = replyToAuthorId && replyToAuthorId !== author.id && !mentioned.has(replyToAuthorId) ? replyToAuthorId : null;
  const preview = previewText(message.body, 120);
  const url = chatDepartmentUrl(message.id);

  for (const userId of mentioned) {
    await notify({
      userId,
      type: "MESSAGE_MENTION",
      subject: "Mentioned in the department chat",
      message: `${author.name} mentioned you in the department chat: "${preview}"`,
      url,
      payload: { channel: DEPARTMENT_CHANNEL_NAME, messageId: message.id },
    });
  }

  if (replyTarget) {
    await notify({
      userId: replyTarget,
      type: "MESSAGE_REPLY",
      subject: "Reply in the department chat",
      message: `${author.name} replied to you in the department chat: "${preview}"`,
      url,
      payload: { channel: DEPARTMENT_CHANNEL_NAME, messageId: message.id },
    });
  }

  for (const userId of memberIds) {
    if (userId === author.id || mentioned.has(userId) || userId === replyTarget) continue;
    publishUserEvent(userId, { name: "chat-activity", data: { channel: DEPARTMENT_CHANNEL_NAME, messageId: message.id } });
  }
}
