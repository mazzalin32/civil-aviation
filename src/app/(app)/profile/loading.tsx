import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <Skeleton className="mb-6 h-8 w-64" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div className="flex flex-col gap-5">
          <Skeleton className="h-72 rounded-card" />
          <Skeleton className="h-40 rounded-card" />
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-20 rounded-card" />
          <Skeleton className="h-[460px] rounded-card" />
        </div>
      </div>
    </>
  );
}
