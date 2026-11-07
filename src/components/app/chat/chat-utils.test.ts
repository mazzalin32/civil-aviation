import { describe, expect, it } from "vitest";
import type { SerializedChatMessage } from "@/app/(app)/cases/[id]/tabs/discussion-actions";
import { findFirstUnreadId, matchesThreadSearch, serializeMentions } from "./chat-utils";

const msg = (over: Partial<SerializedChatMessage>): SerializedChatMessage => ({
  id: "m", matterId: "x", body: "", createdAt: "2026-11-07T10:00:00.000Z", authorId: "other", authorName: "Other",
  isPinned: false, pinnedAt: null, pinnedById: null, pinnedByName: null, deletedAt: null, editedAt: null, replyTo: null,
  attachments: [], mentions: [], ...over,
});

describe("findFirstUnreadId", () => {
  const lastRead = "2026-11-07T10:30:00.000Z";
  const messages = [
    msg({ id: "old", createdAt: "2026-11-07T10:00:00.000Z" }),
    msg({ id: "mine", authorId: "me", createdAt: "2026-11-07T11:00:00.000Z" }),
    msg({ id: "gone", createdAt: "2026-11-07T11:05:00.000Z", deletedAt: "2026-11-07T11:06:00.000Z" }),
    msg({ id: "first-new", createdAt: "2026-11-07T11:10:00.000Z" }),
    msg({ id: "later", createdAt: "2026-11-07T11:20:00.000Z" }),
  ];
  it("is the first message from someone else after the read marker", () => {
    expect(findFirstUnreadId(messages, "me", lastRead)).toBe("first-new");
  });
  it("skips your own and deleted messages", () => {
    expect(findFirstUnreadId(messages.slice(1, 3), "me", lastRead)).toBeNull();
  });
  it("is null when everything is read", () => {
    expect(findFirstUnreadId(messages, "me", "2026-11-07T12:00:00.000Z")).toBeNull();
  });
});

describe("matchesThreadSearch", () => {
  it("matches body, author and attachment names, case-insensitively", () => {
    const m = msg({ body: "Hearing moved", authorName: "Agnes Nakato", attachments: [{ id: "a", name: "Affidavit.pdf", size: 1, mimeType: "application/pdf", isLinkedDocument: false, downloadUrl: "/x" }] });
    expect(matchesThreadSearch(m, "hearing")).toBe(true);
    expect(matchesThreadSearch(m, "AGNES")).toBe(true);
    expect(matchesThreadSearch(m, "affidavit")).toBe(true);
    expect(matchesThreadSearch(m, "judgment")).toBe(false);
    expect(matchesThreadSearch(m, "  ")).toBe(true);
  });
});

describe("serializeMentions", () => {
  it("swaps a picked @Name for its stored token", () => {
    expect(serializeMentions("Hi @Agnes Nakato please look", [{ id: "u1", name: "Agnes Nakato" }])).toBe("Hi @[Agnes Nakato](user:u1) please look");
  });
  it("leaves text alone when the mention was deleted from the box", () => {
    expect(serializeMentions("Hi there", [{ id: "u1", name: "Agnes Nakato" }])).toBe("Hi there");
  });
});
