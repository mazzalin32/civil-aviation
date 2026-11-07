import { describe, expect, it } from "vitest";
import { CHAT_NOTIFICATION_TYPES, chatCaseIdFromUrl, chatMessageUrl, currentNotificationUrl } from "./links";

describe("notification links", () => {
  it("builds a Chat deep link", () => expect(chatMessageUrl("m1", "x9")).toBe("/chat?caseId=m1&msg=x9"));
  it("rewrites the legacy Discussion-tab mention link", () => {
    expect(currentNotificationUrl("/cases/cmw68tfzl00571ou4puipj07z?tab=discussion#msg-cmw699vc2000bk4u466msqr3s")).toBe(
      "/chat?caseId=cmw68tfzl00571ou4puipj07z&msg=cmw699vc2000bk4u466msqr3s",
    );
  });
  it("leaves other links and null alone", () => {
    expect(currentNotificationUrl("/cases/abc")).toBe("/cases/abc");
    expect(currentNotificationUrl("/cases/abc?tab=documents")).toBe("/cases/abc?tab=documents");
    expect(currentNotificationUrl(null)).toBeNull();
  });
});

describe("chat notification helpers", () => {
  it("reads the case from a thread or message link", () => {
    expect(chatCaseIdFromUrl("/chat?caseId=m1")).toBe("m1");
    expect(chatCaseIdFromUrl("/chat?caseId=m1&msg=x9")).toBe("m1");
  });
  it("ignores other links", () => {
    expect(chatCaseIdFromUrl("/cases/m1")).toBeNull();
    expect(chatCaseIdFromUrl(null)).toBeNull();
  });
  it("knows which notification types are chat activity", () => {
    expect(CHAT_NOTIFICATION_TYPES).toEqual(expect.arrayContaining(["CASE_MESSAGE", "MESSAGE_REPLY", "MESSAGE_MENTION"]));
    expect(CHAT_NOTIFICATION_TYPES).not.toContain("TASK_ASSIGNED");
  });
});
