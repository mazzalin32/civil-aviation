"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Briefcase, CalendarDays, Check, CheckCircle2, FolderPlus, Mail, UserPlus, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { dismissWelcome } from "@/app/(app)/dashboard/actions";

type Step = { icon: LucideIcon; title: string; body: string; href: string; cta: string; done?: boolean };

function stepsFor(role: "ADMIN" | "LAWYER", digestEnabled: boolean): Step[] {
  const digest: Step = {
    icon: Mail,
    title: "Turn on email digests",
    body: "One short email each morning with today's hearings, deadlines and tasks.",
    href: "/profile",
    cta: "Open Profile",
    done: digestEnabled,
  };
  if (role === "ADMIN") {
    return [
      { icon: UserPlus, title: "Invite your lawyers", body: "Each gets an email link to choose their password. You'll see who hasn't accepted yet on Users.", href: "/users?new=1", cta: "Add a lawyer" },
      { icon: FolderPlus, title: "Open the first matter", body: "Pick its category and type, assign a lead lawyer, and the lifecycle and reminders follow.", href: "/cases/new", cta: "New matter" },
      digest,
    ];
  }
  return [
    { icon: Briefcase, title: "Your matters will appear here", body: "When the Head of Legal assigns you to a matter, it shows up on this page and in Cases.", href: "/cases", cta: "Open Cases" },
    { icon: CalendarDays, title: "Your calendar fills automatically", body: "Hearings, mentions and deadlines from your matters land on your calendar, with reminders before each.", href: "/calendar", cta: "Open Calendar" },
    digest,
  ];
}

/** First-sign-in welcome (FLOWS §3 step 3). Shown until the person closes it; closing is saved to their account. */
export function WelcomeCard({ name, role, digestEnabled }: { name: string; role: "ADMIN" | "LAWYER"; digestEnabled: boolean }) {
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();
  if (hidden) return null;

  function close() {
    setHidden(true);
    startTransition(async () => {
      try {
        await dismissWelcome();
      } catch {
        setHidden(false);
        toast.error("Couldn't close the welcome card. Try again.");
      }
    });
  }

  return (
    <Card className="mb-4 p-6" aria-labelledby="welcome-title">
      <div className="mb-5 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="welcome-title" className="m-0 text-base font-semibold">
            Welcome to CAA Legal, {name}
          </h2>
          <p className="m-0 mt-0.5 text-[13px] text-text-muted">Three things to know before you start.</p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={close} disabled={pending} aria-label="Close the welcome card">
          <X className="size-4" />
        </Button>
      </div>
      <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
        {stepsFor(role, digestEnabled).map((s, i) => (
          <li key={s.title} className="flex flex-col gap-2 rounded-control border border-border p-4">
            <div className="flex items-center gap-2 text-text-muted">
              <s.icon className="size-4" />
              <span className="text-xs font-medium tabular-nums">Step {i + 1}</span>
            </div>
            <p className="m-0 text-sm font-semibold">{s.title}</p>
            <p className="m-0 flex-1 text-[13px] text-text-muted">{s.body}</p>
            {s.done ? (
              <span className="inline-flex items-center gap-1 text-[13px] font-medium text-success">
                <CheckCircle2 className="size-3.5" /> Already on
              </span>
            ) : (
              <Link href={s.href} className="text-[13px] font-medium text-primary hover:underline">
                {s.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-5 flex justify-end">
        <Button type="button" onClick={close} disabled={pending}>
          <Check className="size-4" /> Got it
        </Button>
      </div>
    </Card>
  );
}
