import { describe, expect, it } from "vitest";
import { CLOSED_CHAT_MESSAGE, MESSAGE_EDIT_WINDOW_MINUTES, checkCanDeleteMessage, isMatterChatReadOnly, withinEditWindow } from "./rules";

const now = new Date("2026-11-07T12:00:00Z");
const ago = (min: number) => new Date(now.getTime() - min * 60_000);

describe("chat rules", () => {
  it("only a CLOSED matter is read-only", () => {
    expect(isMatterChatReadOnly("CLOSED")).toBe(true);
    for (const s of ["OPEN", "ON_HOLD", "CLOSURE_REQUESTED"]) expect(isMatterChatReadOnly(s)).toBe(false);
  });

  it("edit window is inclusive of the limit", () => {
    expect(withinEditWindow(ago(MESSAGE_EDIT_WINDOW_MINUTES), now)).toBe(true);
    expect(withinEditWindow(ago(MESSAGE_EDIT_WINDOW_MINUTES + 1), now)).toBe(false);
  });

  it("lets an author delete their own recent message", () => {
    expect(checkCanDeleteMessage({ isAuthor: true, isAdmin: false, createdAt: ago(5), matterStatus: "OPEN", now })).toEqual({ ok: true });
  });

  it("stops an author deleting after the window", () => {
    const r = checkCanDeleteMessage({ isAuthor: true, isAdmin: false, createdAt: ago(60), matterStatus: "OPEN", now });
    expect(r.ok).toBe(false);
  });

  it("does not let a non-author delete — including the lead lawyer", () => {
    const r = checkCanDeleteMessage({ isAuthor: false, isAdmin: false, createdAt: ago(1), matterStatus: "OPEN", now });
    expect(r).toEqual({ ok: false, error: "You can only delete your own messages." });
  });

  it("lets an Admin delete any message at any time", () => {
    expect(checkCanDeleteMessage({ isAuthor: false, isAdmin: true, createdAt: ago(5000), matterStatus: "OPEN", now })).toEqual({ ok: true });
  });

  it("blocks everyone, Admin included, once the matter is closed", () => {
    expect(checkCanDeleteMessage({ isAuthor: true, isAdmin: true, createdAt: ago(1), matterStatus: "CLOSED", now })).toEqual({ ok: false, error: CLOSED_CHAT_MESSAGE });
  });
});
