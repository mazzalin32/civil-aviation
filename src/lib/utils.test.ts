import { describe, expect, it } from "vitest";
import { homePathFor, NAV, titleFor } from "@/components/app/nav-config";
import { formatDate, formatUGX } from "./time";
import { initials } from "./utils";

describe("initials", () => {
  it("uses first and last name", () => expect(initials("David Ssemwogerere")).toBe("DS"));
  it("handles a single name and extra spaces", () => expect(initials("  agnes ")).toBe("A"));
});

describe("formatting", () => {
  it("formats UGX as whole shillings", () => expect(formatUGX(1840000000)).toMatch(/^UGX 1,840,000,000$/));
  it("shows dates in Kampala time (UTC+3)", () => {
    // 22:30 UTC on 1 Oct is already 2 Oct in Kampala.
    expect(formatDate(new Date("2026-10-01T22:30:00Z"), { day: "numeric" })).toBe("2");
  });
});

describe("navigation", () => {
  it("sends each role to its own home", () => {
    expect(homePathFor("ADMIN")).toBe("/dashboard");
    expect(homePathFor("LAWYER")).toBe("/dashboard");
  });
  it("keeps admin-only areas out of the lawyer nav", () => {
    const lawyerPaths = NAV.LAWYER.map((n) => n.href);
    // Reports moved to the shared section (prototype: whole org sees the same data) —
    // only account/settings-style admin areas stay Admin-only.
    for (const p of ["/users", "/settings", "/closure-requests"]) expect(lawyerPaths).not.toContain(p);
  });
  it("derives the top-bar title from nested paths", () => expect(titleFor("/cases/new", "ADMIN")).toBe("Legal Matters"));
});
