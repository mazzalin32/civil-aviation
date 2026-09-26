import { cn, initials } from "@/lib/utils";

const TONES = ["bg-avatar-1", "bg-avatar-2", "bg-avatar-3"] as const;

/** Stable colour per user, cycling through the avatar tokens. */
function toneFor(seed: string) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}

export function Avatar({ name, seed, className }: { name: string; seed?: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-[30px] shrink-0 place-items-center rounded-full text-xs font-semibold text-on-avatar",
        toneFor(seed ?? name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
