import { EventEmitter } from "events";

export type ChatEventType = "message.created" | "message.pinned" | "message.deleted";

export type ChatEvent = {
  type: ChatEventType;
  matterId: string;
  data: unknown;
};

class ChatEventBus extends EventEmitter {
  constructor() {
    super();
    // Allow many simultaneous clients on busy cases
    this.setMaxListeners(200);
  }

  publish(event: ChatEvent) {
    this.emit(`matter:${event.matterId}`, event);
  }

  subscribe(matterId: string, listener: (event: ChatEvent) => void) {
    const channel = `matter:${matterId}`;
    this.on(channel, listener);
    return () => {
      this.off(channel, listener);
    };
  }
}

const globalForChat = globalThis as unknown as {
  chatEventBus?: ChatEventBus;
};

export const chatEventBus = globalForChat.chatEventBus ?? new ChatEventBus();
if (process.env.NODE_ENV !== "production") {
  globalForChat.chatEventBus = chatEventBus;
}
