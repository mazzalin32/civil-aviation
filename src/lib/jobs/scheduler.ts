import "server-only";
import { PgBoss } from "pg-boss";
import { env } from "../env";
import { APP_TIME_ZONE } from "../time";
import { runDueJobs } from "./run";

const QUEUE = "reminders-tick";

const state = globalThis as unknown as { __caaJobRunner?: Promise<PgBoss | null> };

/**
 * Starts the job runner inside the Next.js server (called from src/instrumentation.ts).
 *
 * pg-boss keeps its queue in Postgres (its own `pgboss` schema), so the once-a-minute tick is
 * scheduled once for the whole database: with one app instance or several, exactly one of them
 * runs each tick. The `exclusive` queue policy also stops a slow run from overlapping the next.
 * If the database is down at boot, the server still starts; the runner logs and stays off until restart.
 */
export function startJobRunner(): Promise<PgBoss | null> {
  state.__caaJobRunner ??= start().catch((err) => {
    console.error("jobs: the job runner could not start — reminders and chat emails are paused until the next restart", err);
    return null;
  });
  return state.__caaJobRunner;
}

async function start(): Promise<PgBoss | null> {
  if (!env.JOBS_ENABLED) {
    console.info("jobs: JOBS_ENABLED=false — the job runner is off in this process");
    return null;
  }
  const boss = new PgBoss({ connectionString: env.DATABASE_URL, schema: "pgboss", application_name: "caa-legal-jobs" });
  boss.on("error", (err) => console.error("jobs: pg-boss error", err));
  await boss.start();

  await boss.createQueue(QUEUE, { policy: "exclusive", retryLimit: 0, expireInSeconds: 300 });
  await boss.schedule(QUEUE, "* * * * *", null, { tz: APP_TIME_ZONE });
  await boss.work(QUEUE, { pollingIntervalSeconds: 10 }, async () => {
    const result = await runDueJobs();
    if (Object.keys(result).length) console.info("jobs: run", result);
    return result;
  });

  const stop = () => void boss.stop({ graceful: true }).catch(() => {});
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  console.info("jobs: job runner started (every minute)");
  return boss;
}
