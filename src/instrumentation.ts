/**
 * Runs once when a Next.js server instance starts (Next's instrumentation hook). Used to start the
 * background job runner — reminders, the morning digest and unread-chat emails (src/lib/jobs).
 * Not awaited: a slow or unreachable database must not hold up the server answering requests.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startJobRunner } = await import("./lib/jobs/scheduler");
  void startJobRunner();
}
