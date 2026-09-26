import { cn } from "@/lib/utils";

export function FormAlert({ tone = "danger", children }: { tone?: "danger" | "info"; children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className={cn(
        "m-0 rounded-control border px-3 py-2 text-[13px]",
        tone === "danger" ? "border-transparent bg-danger-soft text-danger" : "border-transparent bg-primary-soft text-primary",
      )}
    >
      {children}
    </p>
  );
}
