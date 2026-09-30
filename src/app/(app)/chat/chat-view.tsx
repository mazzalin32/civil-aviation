"use client";

import { useRef, useState, useTransition } from "react";
import { Mic, Paperclip, Phone, Send, Video } from "lucide-react";
import { Avatar } from "@/components/app/avatar";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/time";
import { postGroupMessage } from "./actions";

export type GroupChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
};

/** Calling/attachments are UI-only for this prototype (agreed: no real calling backend) —
 *  clicking one just says so instead of silently doing nothing or crashing. */
function useNotReady() {
  const [note, setNote] = useState<string>();
  function trigger(what: string) {
    setNote(`${what} isn't wired up in this prototype yet.`);
    window.setTimeout(() => setNote(undefined), 2500);
  }
  return { note, trigger };
}

export function ChatView({ currentUserId, messages }: { currentUserId: string; messages: GroupChatMessage[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const { note, trigger } = useNotReady();

  function send(formData: FormData) {
    startTransition(async () => {
      const result = await postGroupMessage({ body: formData.get("body") });
      if (result?.error) {
        window.alert(result.error);
        return;
      }
      formRef.current?.reset();
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between rounded-card border border-border bg-surface px-5 py-3 shadow-card">
        <div>
          <b className="block text-[14px] font-semibold">Department Group Chat</b>
          <p className="m-0 text-xs text-text-muted">Everyone in the department</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => trigger("Voice calling")} aria-label="Voice call" className="grid size-9 place-items-center rounded-control text-text-muted hover:bg-surface-muted hover:text-text">
            <Phone className="size-4" />
          </button>
          <button type="button" onClick={() => trigger("Video calling")} aria-label="Video call" className="grid size-9 place-items-center rounded-control text-text-muted hover:bg-surface-muted hover:text-text">
            <Video className="size-4" />
          </button>
        </div>
      </div>

      {note && <p className="m-0 rounded-control bg-primary-soft px-3 py-2 text-center text-[13px] text-primary">{note}</p>}

      <div className="grid gap-3 rounded-card border border-border bg-surface p-5 shadow-card">
        {messages.length === 0 ? (
          <p className="m-0 text-[13px] text-text-muted">No messages yet — start the department conversation.</p>
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0">
            {messages.map((m) => {
              const mine = m.authorId === currentUserId;
              return (
                <li key={m.id} className={`flex gap-3 ${mine ? "flex-row-reverse" : ""}`}>
                  <Avatar name={m.authorName} seed={m.authorId} />
                  <div className={`max-w-[min(560px,80%)] rounded-card px-3.5 py-2.5 ${mine ? "bg-primary-soft" : "bg-surface-muted"}`}>
                    <div className="mb-1 flex flex-wrap items-baseline gap-2">
                      <b className="text-[13px] font-semibold">{mine ? "You" : m.authorName}</b>
                      <time className="text-[11px] text-text-muted">
                        {formatDate(new Date(m.createdAt), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                      </time>
                    </div>
                    <p className="m-0 text-[13.5px] whitespace-pre-wrap">{m.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form ref={formRef} action={send} className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => trigger("Attaching files")}
          aria-label="Attach a file"
          className="grid size-11 shrink-0 place-items-center rounded-control text-text-muted hover:bg-surface-muted hover:text-text"
        >
          <Paperclip className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => trigger("Voice notes")}
          aria-label="Record a voice note"
          className="grid size-11 shrink-0 place-items-center rounded-control text-text-muted hover:bg-surface-muted hover:text-text"
        >
          <Mic className="size-4" />
        </button>
        <textarea
          name="body"
          rows={2}
          required
          placeholder="Write a message to the department…"
          className="min-h-[44px] flex-1 rounded-control border border-border bg-surface p-3 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        />
        <Button type="submit" variant="primary" disabled={pending}>
          <Send className="size-4" />
          {pending ? "Sending…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
