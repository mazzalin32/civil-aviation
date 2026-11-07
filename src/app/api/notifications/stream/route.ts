import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { subscribeToUserEvents } from "@/lib/notifications/event-bus";
import { sseResponse } from "@/lib/sse";

export const dynamic = "force-dynamic";

// The session can expire or be revoked while a stream is open. Closing every so often makes the
// browser's EventSource reconnect, which re-runs the auth check below — a signed-out user stops
// receiving events within this window instead of never.
const MAX_STREAM_MS = 10 * 60_000;

/** Live events for the signed-in user (SSE): their own notifications and chat-activity pings. Nobody else's. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  return sseResponse(
    request,
    (send) => subscribeToUserEvents(user.id, (event) => send(event.name, event.data)),
    { maxAgeMs: MAX_STREAM_MS },
  );
}
