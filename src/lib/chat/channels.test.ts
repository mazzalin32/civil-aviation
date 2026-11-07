import { describe, expect, it } from "vitest";
import { DEPARTMENT_CHANNEL_NAME, departmentChannel } from "./channels";

describe("department channel key", () => {
  it("is per organisation, so one organisation's events never reach another's", () => {
    expect(departmentChannel("org-a")).not.toBe(departmentChannel("org-b"));
    expect(departmentChannel("org-a")).toBe("dept:org-a");
  });
  it("can never collide with a case thread's key (a bare matter id)", () => {
    expect(departmentChannel("abc").startsWith("dept:")).toBe(true);
  });
  it("has a stable client-facing name", () => expect(DEPARTMENT_CHANNEL_NAME).toBe("department"));
});
