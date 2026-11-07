import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { chatEventBus } from "@/lib/chat/event-bus";
import { departmentChannel } from "@/lib/chat/channels";
import { sseResponse } from "@/lib/sse";

export const dynamic = "force-dynamic";

// Closing now and then makes the browser reconnect, which re-runs the auth check below.
const MAX_STREAM_MS = 10 * 60_000;

/** Live updates for the department channel — only for staff of the same organisation. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (!user.organizationId || (user.role !== "ADMIN" && user.role !== "LAWYER")) return new NextResponse("Forbidden", { status: 403 });

  const channel = departmentChannel(user.organizationId);
  return sseResponse(
    request,
    (send) => chatEventBus.subscribe(channel, (event) => send(event.type, event.data)),
    { maxAgeMs: MAX_STREAM_MS },
  );
}
