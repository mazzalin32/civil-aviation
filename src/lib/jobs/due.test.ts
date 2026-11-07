import { describe, expect, it } from "vitest";
import { addDays, daysBetween, dueStageAfter, dueStageBefore, kampalaDay, kampalaHour, relativeDay } from "./due";

describe("Kampala calendar days", () => {
  it("uses the Kampala date, not the UTC one", () => {
    // 22:30 UTC on the 14th is already 01:30 on the 15th in Kampala (UTC+3).
    expect(kampalaDay(new Date("2026-11-14T22:30:00Z"))).toBe("2026-11-15");
    expect(kampalaDay(new Date("2026-11-14T20:59:00Z"))).toBe("2026-11-14");
    expect(kampalaHour(new Date("2026-11-14T04:00:00Z"))).toBe(7);
  });

  it("counts whole days across month and year ends", () => {
    expect(daysBetween("2026-11-07", "2026-11-14")).toBe(7);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2026-11-14", "2026-11-07")).toBe(-7);
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
  });
});

describe("dueStageBefore (hearings, deadlines, certificates)", () => {
  const schedule = [7, 3, 1, 0, -1];

  it("is silent until the first stage is reached", () => {
    expect(dueStageBefore(schedule, 8)).toBeUndefined();
    expect(dueStageBefore(schedule, 30)).toBeUndefined();
  });

  it("picks the latest stage reached, so a late-added date skips straight to it", () => {
    expect(dueStageBefore(schedule, 7)).toBe(7);
    expect(dueStageBefore(schedule, 5)).toBe(7);
    expect(dueStageBefore(schedule, 2)).toBe(3);
    expect(dueStageBefore(schedule, 1)).toBe(1);
    expect(dueStageBefore(schedule, 0)).toBe(0);
  });

  it("uses a negative offset for overdue, once, however late it is", () => {
    expect(dueStageBefore(schedule, -1)).toBe(-1);
    expect(dueStageBefore(schedule, -12)).toBe(-1);
  });

  it("without an overdue offset, a past date stays on its last stage (already sent)", () => {
    expect(dueStageBefore([7, 1, 0], -3)).toBe(0);
  });

  it("does not depend on the order the Admin typed the offsets in", () => {
    expect(dueStageBefore([0, 7, 1], 4)).toBe(7);
  });
});

describe("dueStageAfter (outcome missing, case inactive)", () => {
  it("waits until the first stage, then escalates to the largest stage passed", () => {
    expect(dueStageAfter([1, 3], 0)).toBeUndefined();
    expect(dueStageAfter([1, 3], 1)).toBe(1);
    expect(dueStageAfter([1, 3], 2)).toBe(1);
    expect(dueStageAfter([1, 3], 3)).toBe(3);
    expect(dueStageAfter([1, 3], 40)).toBe(3);
  });

  it("ignores the sign, since these only ever look back", () => {
    expect(dueStageAfter([-1, -3], 2)).toBe(1);
    expect(dueStageAfter([30], 29)).toBeUndefined();
    expect(dueStageAfter([30], 31)).toBe(30);
  });
});

describe("relativeDay", () => {
  it("reads naturally", () => {
    expect(relativeDay(0)).toBe("today");
    expect(relativeDay(1)).toBe("tomorrow");
    expect(relativeDay(7)).toBe("in 7 days");
    expect(relativeDay(-1)).toBe("yesterday");
    expect(relativeDay(-4)).toBe("4 days ago");
  });
});
