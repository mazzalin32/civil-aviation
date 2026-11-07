/** Chat event-bus key for an organisation's department channel (case threads are keyed by matter id). */
export function departmentChannel(organizationId: string) {
  return `dept:${organizationId}`;
}

/** What the client sees as `channel` in chat-activity events for the department channel. */
export const DEPARTMENT_CHANNEL_NAME = "department";
