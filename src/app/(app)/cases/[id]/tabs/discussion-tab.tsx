"use client";

import { useRef, useTransition } from "react";
import { Send } from "lucide-react";
import { Avatar } from "@/components/app/avatar";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/time";
import { postMessage } from "./discussion-actions";

export type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
};

export function DiscussionTab({
  matterId,
  currentUserId,
  messages,
}: {
  matterId: string;
  currentUserId: string;
  messages: ChatMessage[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function send(formData: FormData) {
    const body = formData.get("body");
    startTransition(async () => {
      const result = await postMessage({ matterId, body });
      if (result?.error) {
        window.alert(result.error);
        return;
      }
      formRef.current?.reset();
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-card border border-border bg-surface p-5 shadow-card">
        {messages.length === 0 ? (
          <p className="m-0 text-[13px] text-text-muted">No messages yet — start the thread for this case.</p>
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
        <textarea
          name="body"
          rows={2}
          required
          placeholder="Write a message…"
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
