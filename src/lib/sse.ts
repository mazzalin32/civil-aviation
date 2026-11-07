import { NextResponse } from "next/server";

const HEARTBEAT_MS = 15_000;

/**
 * A Server-Sent Events response. `setup` is called once with a `send(event, data)` function and returns
 * the cleanup to run when the client goes away. The stream sends a `connected` event first (so a client
 * can re-sync on every reconnect), a heartbeat to keep proxies from closing it, and — if `maxAgeMs` is
 * set — closes itself after that long so the browser reconnects and the caller's auth check runs again.
 */
export function sseResponse(
  request: Request,
  setup: (send: (event: string, data: unknown) => void) => () => void,
  opts: { maxAgeMs?: number } = {},
) {
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup?.(); // stream already closed
        }
      };

      send("connected", { time: new Date().toISOString() });
      const teardown = setup(send);
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          cleanup?.();
        }
      }, HEARTBEAT_MS);
      const maxAge = opts.maxAgeMs
        ? setTimeout(() => {
            cleanup?.();
            try {
              controller.close();
            } catch {
              /* already closed */
            }
          }, opts.maxAgeMs)
        : null;

      cleanup = () => {
        teardown();
        clearInterval(heartbeat);
        if (maxAge) clearTimeout(maxAge);
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
