import { EventEmitter } from "events";
import type { NotificationItem } from "./item";

/**
 * Per-user fan-out for live notifications — same in-process pattern as the chat bus
 * (src/lib/chat/event-bus.ts). It only reaches SSE connections held by *this* Node process;
 * if notifications ever need to be published from another process (a reminder job runner) or
 * the app runs on several instances, swap this file's internals for Postgres LISTEN/NOTIFY
 * (PROJECT_SPEC §4) — `publishNotification` / `subscribeToNotifications` stay the same.
 */
class NotificationBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200); // one listener per open tab
  }
}

const globalForBus = globalThis as unknown as { notificationBus?: NotificationBus };
const bus = globalForBus.notificationBus ?? new NotificationBus();
if (process.env.NODE_ENV !== "production") globalForBus.notificationBus = bus;

export function publishNotification(userId: string, item: NotificationItem) {
  bus.emit(`user:${userId}`, item);
}

export function subscribeToNotifications(userId: string, listener: (item: NotificationItem) => void) {
  const channel = `user:${userId}`;
  bus.on(channel, listener);
  return () => {
    bus.off(channel, listener);
  };
}
