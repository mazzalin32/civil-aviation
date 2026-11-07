import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { subscribeToNotifications } from "@/lib/notifications/event-bus";

export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 15_000;
// The session can expire or be revoked while a stream is open. Closing every so often makes the
// browser's EventSource reconnect, which re-runs the auth check above — a signed-out user stops
// receiving notifications within this window instead of never.
const MAX_STREAM_MS = 10 * 60_000;

/** Live notifications for the signed-in user (SSE). Only ever streams that user's own events. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup?.(); // stream already closed
        }
      };

      // Fires on every (re)connect, so the client can catch up on anything it missed while offline.
      send(`event: connected\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`);

      const unsubscribe = subscribeToNotifications(user.id, (item) => send(`event: notification\ndata: ${JSON.stringify(item)}\n\n`));
      const heartbeat = setInterval(() => send(`: ping\n\n`), HEARTBEAT_MS);
      const maxAge = setTimeout(() => {
        cleanup?.();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }, MAX_STREAM_MS);

      cleanup = () => {
        unsubscribe();
        clearInterval(heartbeat);
        clearTimeout(maxAge);
        cleanup = null;
      };
    },
    cancel() {
      cleanup?.();
    },
  });

  request.signal.addEventListener("abort", () => cleanup?.());

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
