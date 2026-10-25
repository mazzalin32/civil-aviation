import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessMatterChat } from "@/lib/authz";
import { db } from "@/lib/db";
import { chatEventBus, type ChatEvent } from "@/lib/chat/event-bus";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matterId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const matter = await db.matter.findUnique({ where: { id: matterId }, select: { organizationId: true } });
  if (!matter || matter.organizationId !== user.organizationId) {
    return new NextResponse("Not found", { status: 404 });
  }

  const allowed = await canAccessMatterChat(user.id, user.role, matterId);
  if (!allowed) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let cleanup: (() => void) | null = null;
  let keepAliveInterval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection event
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ matterId, time: new Date().toISOString() })}\n\n`));

      // Listen for chat events on this matter
      const onEvent = (event: ChatEvent) => {
        try {
          const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream might be closed
        }
      };

      const unsubscribe = chatEventBus.subscribe(matterId, onEvent);

      // Keep-alive heartbeat every 15 seconds
      keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          if (keepAliveInterval) clearInterval(keepAliveInterval);
        }
      }, 15000);

      cleanup = () => {
        unsubscribe();
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }
      };
    },
    cancel() {
      if (cleanup) {
        cleanup();
        cleanup = null;
      }
    },
  });

  // Handle client disconnection
  request.signal.addEventListener("abort", () => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
