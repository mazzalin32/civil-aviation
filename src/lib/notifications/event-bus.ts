import { EventEmitter } from "events";
import type { NotificationItem } from "./item";

/**
 * Per-user fan-out for live events — same in-process pattern as the chat bus
 * (src/lib/chat/event-bus.ts). It only reaches SSE connections held by *this* Node process;
 * if events ever need to be published from another process (a reminder job runner) or
 * the app runs on several instances, swap this file's internals for Postgres LISTEN/NOTIFY
 * (PROJECT_SPEC §4) — the exported functions stay the same.
 *
 * Event names on the wire: "notification" (a bell entry, data = NotificationItem) and
 * "chat-activity" (something new in a chat that has no bell entry, data = { channel }).
 */
export type UserEvent = { name: "notification"; data: NotificationItem } | { name: "chat-activity"; data: { channel: string; messageId: string } };

class NotificationBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200); // one listener per open tab
  }
}

const globalForBus = globalThis as unknown as { notificationBus?: NotificationBus };
const bus = globalForBus.notificationBus ?? new NotificationBus();
if (process.env.NODE_ENV !== "production") globalForBus.notificationBus = bus;

export function publishUserEvent(userId: string, event: UserEvent) {
  bus.emit(`user:${userId}`, event);
}

export function publishNotification(userId: string, item: NotificationItem) {
  publishUserEvent(userId, { name: "notification", data: item });
}

export function subscribeToUserEvents(userId: string, listener: (event: UserEvent) => void) {
  const channel = `user:${userId}`;
  bus.on(channel, listener);
  return () => {
    bus.off(channel, listener);
  };
}
