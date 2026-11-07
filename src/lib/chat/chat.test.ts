import { describe, expect, it, vi } from "vitest";
import {
  postCaseMessageSchema,
  togglePinMessageSchema,
  deleteCaseMessageSchema,
  MAX_CHAT_ATTACHMENT_BYTES,
} from "@/lib/validation/case-chat";
import { chatEventBus, type ChatEvent } from "./event-bus";

describe("Case Chat Validation Schemas", () => {
  describe("postCaseMessageSchema", () => {
    it("validates valid message inputs", () => {
      const parsed = postCaseMessageSchema.parse({
        matterId: "matter-123",
        body: "Hello team, here is the update.",
        attachedDocumentIds: ["doc-1"],
      });
      expect(parsed.matterId).toBe("matter-123");
      expect(parsed.body).toBe("Hello team, here is the update.");
      expect(parsed.attachedDocumentIds).toEqual(["doc-1"]);
    });

    it("applies default empty arrays and empty body", () => {
      const parsed = postCaseMessageSchema.parse({
        matterId: "matter-456",
      });
      expect(parsed.body).toBe("");
      expect(parsed.attachedDocumentIds).toEqual([]);
    });

    it("fails when matterId is empty", () => {
      const result = postCaseMessageSchema.safeParse({
        matterId: "",
        body: "Test",
      });
      expect(result.success).toBe(false);
    });

    it("fails when message body exceeds 4000 characters", () => {
      const longBody = "a".repeat(4001);
      const result = postCaseMessageSchema.safeParse({
        matterId: "matter-123",
        body: longBody,
      });
      expect(result.success).toBe(false);
    });

    it("defines 25MB attachment limit", () => {
      expect(MAX_CHAT_ATTACHMENT_BYTES).toBe(25 * 1024 * 1024);
    });
  });

  describe("togglePinMessageSchema", () => {
    it("validates pin/unpin inputs", () => {
      const parsed = togglePinMessageSchema.parse({
        matterId: "matter-123",
        messageId: "msg-1",
        isPinned: true,
      });
      expect(parsed.isPinned).toBe(true);
    });

    it("rejects non-boolean isPinned", () => {
      const result = togglePinMessageSchema.safeParse({
        matterId: "matter-123",
        messageId: "msg-1",
        isPinned: "true",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("deleteCaseMessageSchema", () => {
    it("validates delete inputs", () => {
      const parsed = deleteCaseMessageSchema.parse({
        matterId: "matter-123",
        messageId: "msg-1",
      });
      expect(parsed.matterId).toBe("matter-123");
      expect(parsed.messageId).toBe("msg-1");
    });
  });
});

describe("Chat Event Bus", () => {
  it("delivers events to subscribers of matching matterId", () => {
    const received: ChatEvent[] = [];
    const unsubscribe = chatEventBus.subscribe("matter-bus-1", (event) => {
      received.push(event);
    });

    const event: ChatEvent = {
      type: "message.created",
      matterId: "matter-bus-1",
      data: { id: "msg-100", body: "Realtime test" },
    };

    chatEventBus.publish(event);

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("message.created");
    expect(received[0].matterId).toBe("matter-bus-1");

    unsubscribe();
  });

  it("does not deliver events to other matters", () => {
    const received: ChatEvent[] = [];
    const unsubscribe = chatEventBus.subscribe("matter-isolated-A", (event) => {
      received.push(event);
    });

    chatEventBus.publish({
      type: "message.created",
      matterId: "matter-isolated-B",
      data: { id: "msg-200" },
    });

    expect(received).toHaveLength(0);
    unsubscribe();
  });

  it("stops delivering events after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = chatEventBus.subscribe("matter-unsub", listener);

    chatEventBus.publish({
      type: "message.pinned",
      matterId: "matter-unsub",
      data: { messageId: "msg-1", isPinned: true },
    });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();

    chatEventBus.publish({
      type: "message.deleted",
      matterId: "matter-unsub",
      data: { messageId: "msg-1" },
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
