import { describe, expect, it } from "vitest";
import { DEFAULT_MASS_DOWNLOAD, massDownloadPolicySchema, readMassDownloadPolicy, shouldAutoLock } from "./policy";

describe("mass-download policy", () => {
  it("uses the Admin's saved values", () => {
    expect(readMassDownloadPolicy({ files: 30, minutes: 5, autoLock: true })).toEqual({ files: 30, minutes: 5, autoLock: true });
  });

  it("falls back to the defaults when nothing (or something unreadable) is stored", () => {
    expect(readMassDownloadPolicy(undefined)).toEqual(DEFAULT_MASS_DOWNLOAD);
    expect(readMassDownloadPolicy({ files: "lots" })).toEqual(DEFAULT_MASS_DOWNLOAD);
    expect(readMassDownloadPolicy({ files: 1, minutes: 10, autoLock: false })).toEqual(DEFAULT_MASS_DOWNLOAD);
  });

  it("defaults to alerting only, never locking", () => {
    expect(DEFAULT_MASS_DOWNLOAD.autoLock).toBe(false);
    expect(shouldAutoLock(DEFAULT_MASS_DOWNLOAD, "LAWYER")).toBe(false);
  });

  it("auto-locks lawyers only, never an Admin", () => {
    const strict = { files: 50, minutes: 10, autoLock: true };
    expect(shouldAutoLock(strict, "LAWYER")).toBe(true);
    expect(shouldAutoLock(strict, "ADMIN")).toBe(false);
  });

  it("rejects limits that would make no sense", () => {
    expect(massDownloadPolicySchema.safeParse({ files: 0, minutes: 10, autoLock: false }).success).toBe(false);
    expect(massDownloadPolicySchema.safeParse({ files: 50, minutes: 0, autoLock: false }).success).toBe(false);
    expect(massDownloadPolicySchema.safeParse({ files: 2.5, minutes: 10, autoLock: false }).success).toBe(false);
  });
});
