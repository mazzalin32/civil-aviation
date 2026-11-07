import "server-only";
import { writeAudit } from "../audit";
import { sendDueChatEmails } from "./chat-email";
import { REMINDER_START_HOUR, remindersStartDay } from "./common";
import { sendDigests } from "./digest";
import { kampalaDay, kampalaHour } from "./due";
import { certificateReminders, deadlineReminders, hearingReminders, inactiveCaseReminders, outcomeMissingReminders, type Ctx } from "./reminders";

export type RunResult = Record<string, number | string>;

/**
 * One pass of the job runner — called once a minute by the scheduler (./scheduler.ts), and safe to
 * call more often or from several instances: every send is deduplicated (ReminderLog / emailedAt).
 * Each job runs on its own so one failing (say, SMTP down) doesn't stop the others.
 */
export async function runDueJobs(now: Date = new Date()): Promise<RunResult> {
  const today = kampalaDay(now);
  const result: RunResult = {};

  const jobs: [string, () => Promise<number>][] = [["chatEmails", () => sendDueChatEmails(now)]];
  // Day-based reminders wait for the working morning (see REMINDER_START_HOUR).
  if (kampalaHour(now) >= REMINDER_START_HOUR) {
    const ctx: Ctx = { now, today, startDay: await remindersStartDay(now), admins: new Map() };
    jobs.push(
      ["hearings", () => hearingReminders(ctx)],
      ["deadlines", () => deadlineReminders(ctx)],
      ["outcomesMissing", () => outcomeMissingReminders(ctx)],
      ["certificates", () => certificateReminders(ctx)],
      ["inactiveCases", () => inactiveCaseReminders(ctx)],
      ["digests", () => sendDigests(now, today)],
    );
  }

  for (const [name, job] of jobs) {
    try {
      const n = await job();
      if (n) result[name] = n;
    } catch (err) {
      result[name] = "failed";
      console.error(`jobs: ${name} failed`, err);
    }
  }

  // System actions are audited too (CLAUDE.md) — one row per run that actually did something.
  if (Object.keys(result).length) {
    await writeAudit({ userId: null, action: "jobs.run", entity: "JobRun", after: { at: now.toISOString(), ...result } });
  }
  return result;
}
