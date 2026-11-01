"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

const CANDIDATE_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"];

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return CANDIDATE_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Click to record, click again to stop — the recording is handed to `onRecorded` as a File,
 *  ready to drop straight into the same attachment list a picked file would go into. */
export function VoiceRecorder({
  onRecorded,
  buttonClassName = "grid size-11 shrink-0 place-items-center rounded-control",
  iconClassName = "size-4",
}: {
  onRecorded: (file: File) => void;
  buttonClassName?: string;
  iconClassName?: string;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Voice notes aren't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mimeType ?? "audio/webm" });
        if (blob.size > 0) {
          const ext = mimeType?.includes("ogg") ? "ogg" : "webm";
          onRecorded(new File([blob], `Voice note.${ext}`, { type: blob.type }));
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      toast.error("Microphone access was denied. Allow it in your browser to record a voice note.");
    }
  }

  function stop() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  return (
    <button
      type="button"
      onClick={recording ? stop : start}
      className={cn(
        buttonClassName,
        "text-text-muted hover:bg-surface-muted hover:text-text transition-colors",
        recording && "bg-danger-soft text-danger hover:bg-danger-soft motion-safe:animate-pulse motion-reduce:animate-none",
      )}
      aria-label={recording ? "Stop recording" : "Record a voice note"}
      title={recording ? `Recording ${formatElapsed(elapsed)} — click to stop` : "Record a voice note"}
    >
      {recording ? <Square className={cn(iconClassName, "fill-current")} /> : <Mic className={iconClassName} />}
    </button>
  );
}
