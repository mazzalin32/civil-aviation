import { describe, expect, it } from "vitest";
import { accountStatus } from "./invite-status";

const now = new Date("2026-11-08T09:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
const hoursAhead = (h: number) => new Date(now.getTime() + h * 3_600_000);

describe("accountStatus", () => {
  it("deactivated wins over everything, and can't be re-invited", () => {
    const s = accountStatus({ isActive: false, hasPassword: false, link: { sentAt: hoursAgo(1), expiresAt: hoursAhead(71) }, now });
    expect(s).toMatchObject({ key: "deactivated", canResend: false });
  });

  it("someone with a password is active, whatever links exist", () => {
    const s = accountStatus({ isActive: true, hasPassword: true, link: { sentAt: hoursAgo(1), expiresAt: hoursAhead(71) }, now });
    expect(s).toMatchObject({ key: "active", label: "Active", canResend: false, detail: null });
  });

  it("a working link is Invited, with when it was sent and when it runs out", () => {
    const s = accountStatus({ isActive: true, hasPassword: false, link: { sentAt: hoursAgo(48), expiresAt: hoursAhead(24) }, now });
    expect(s).toMatchObject({ key: "invited", tone: "warning", canResend: true });
    expect(s.detail).toBe("Sent 2 days ago · expires in 1 day");
  });

  it("a link just sent says so", () => {
    const s = accountStatus({ isActive: true, hasPassword: false, link: { sentAt: new Date(now.getTime() - 5_000), expiresAt: hoursAhead(72) }, now });
    expect(s.detail).toBe("Sent just now · expires in 3 days");
  });

  it("an expired link is Invite expired, in red, and can be resent", () => {
    const s = accountStatus({ isActive: true, hasPassword: false, link: { sentAt: hoursAgo(75), expiresAt: hoursAgo(3) }, now });
    expect(s).toMatchObject({ key: "expired", label: "Invite expired", tone: "danger", canResend: true, detail: "Link expired 3 hours ago" });
  });

  it("once the link record is gone, it still says when the invite last went out", () => {
    const s = accountStatus({ isActive: true, hasPassword: false, link: null, lastSentAt: hoursAgo(80), now });
    expect(s).toMatchObject({ key: "expired", detail: "Last sent 3 days ago · link no longer works" });
  });

  it("no link at all (e.g. an old account that was never activated) also counts as expired", () => {
    const s = accountStatus({ isActive: true, hasPassword: false, link: null, now });
    expect(s).toMatchObject({ key: "expired", detail: "No working link" });
  });

  it("expiry exactly now is expired, not invited", () => {
    const s = accountStatus({ isActive: true, hasPassword: false, link: { sentAt: hoursAgo(72), expiresAt: now }, now });
    expect(s.key).toBe("expired");
  });
});
