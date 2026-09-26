/**
 * Account lockout policy (spec §9: "lockout after failed attempts"). Pure functions,
 * unit-tested; src/app/(auth)/login/actions.ts is the only caller that touches the DB.
 */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export type LockoutState = { failedLoginCount: number; lockedUntil: Date | null };

export function isLocked(state: Pick<LockoutState, "lockedUntil">, now = new Date()): boolean {
  return state.lockedUntil !== null && state.lockedUntil > now;
}

export function minutesRemaining(lockedUntil: Date, now = new Date()): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 60_000));
}

/** After a failed attempt: bump the counter, and lock once it reaches the threshold. */
export function afterFailedAttempt(state: LockoutState, now = new Date()): LockoutState {
  const failedLoginCount = state.failedLoginCount + 1;
  const lockedUntil = failedLoginCount >= MAX_FAILED_ATTEMPTS ? new Date(now.getTime() + LOCKOUT_MINUTES * 60_000) : null;
  return { failedLoginCount, lockedUntil };
}

/** A successful sign-in (password + 2FA both correct) clears the counter entirely. */
export function afterSuccessfulAttempt(): LockoutState {
  return { failedLoginCount: 0, lockedUntil: null };
}
