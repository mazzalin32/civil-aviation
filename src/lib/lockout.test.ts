import { describe, expect, it } from "vitest";
import { afterFailedAttempt, afterSuccessfulAttempt, isLocked, minutesRemaining, type LockoutState } from "./lockout";

describe("lockout", () => {
  it("does not lock before the 5th failure", () => {
    let state: LockoutState = { failedLoginCount: 0, lockedUntil: null };
    for (let i = 0; i < 4; i++) state = afterFailedAttempt(state);
    expect(state.failedLoginCount).toBe(4);
    expect(state.lockedUntil).toBeNull();
  });

  it("locks for 15 minutes on the 5th failure", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    let state: LockoutState = { failedLoginCount: 4, lockedUntil: null };
    state = afterFailedAttempt(state, now);
    expect(state.failedLoginCount).toBe(5);
    expect(state.lockedUntil?.toISOString()).toBe("2026-01-01T00:15:00.000Z");
    expect(isLocked(state, now)).toBe(true);
  });

  it("unlocks once the lock window has passed", () => {
    const lockedUntil = new Date("2026-01-01T00:15:00Z");
    expect(isLocked({ lockedUntil }, new Date("2026-01-01T00:14:59Z"))).toBe(true);
    expect(isLocked({ lockedUntil }, new Date("2026-01-01T00:15:01Z"))).toBe(false);
  });

  it("a successful attempt clears the counter and any lock", () => {
    expect(afterSuccessfulAttempt()).toEqual({ failedLoginCount: 0, lockedUntil: null });
  });

  it("rounds the remaining time up so it never shows 0 minutes", () => {
    const lockedUntil = new Date("2026-01-01T00:15:00Z");
    expect(minutesRemaining(lockedUntil, new Date("2026-01-01T00:14:30Z"))).toBe(1);
    expect(minutesRemaining(lockedUntil, new Date("2026-01-01T00:00:01Z"))).toBe(15);
  });
});
