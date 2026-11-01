"use client";

import { useEffect, useState } from "react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import { Loader2, TriangleAlert, X } from "lucide-react";
import { getVideoCallCredentials } from "@/app/(app)/cases/[id]/tabs/video-call-actions";

/** Mounted only while the call is open (see below) — its own state starts fresh every time,
 *  so there's no "reset on close" to do synchronously in an effect. */
function CallConnection({ matterId, onClose }: { matterId: string; onClose: () => void }) {
  const [state, setState] = useState<{ url: string; token: string } | { error: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVideoCallCredentials(matterId).then((result) => {
      if (!cancelled) setState("error" in result ? { error: result.error } : { url: result.url, token: result.token });
    });
    return () => {
      cancelled = true;
    };
  }, [matterId]);

  if (!state) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-[13px] text-white/80">
        <Loader2 className="size-4 animate-spin" /> Connecting…
      </div>
    );
  }
  if ("error" in state) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-[13px] text-white/80">
        <TriangleAlert className="size-5 text-warning" />
        {state.error}
      </div>
    );
  }
  return (
    <LiveKitRoom serverUrl={state.url} token={state.token} video audio connect onDisconnected={onClose} className="h-full">
      <VideoConference />
    </LiveKitRoom>
  );
}

export function VideoCallPanel({ matterId, open, onClose }: { matterId: string; open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black" data-lk-theme="default">
      <div className="flex items-center justify-between bg-surface px-4 py-2.5">
        <span className="text-[13px] font-medium text-text">Case video call</span>
        <button type="button" onClick={onClose} aria-label="Leave call" className="grid size-8 place-items-center rounded-control text-text-muted hover:bg-surface-muted hover:text-text">
          <X className="size-4" />
        </button>
      </div>

      <div className="relative flex-1">
        <CallConnection key={matterId} matterId={matterId} onClose={onClose} />
      </div>
    </div>
  );
}
