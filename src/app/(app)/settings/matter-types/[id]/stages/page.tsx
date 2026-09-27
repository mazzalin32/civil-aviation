import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { Card } from "@/components/ui/card";
import { createStage, deleteStage, moveStage, toggleStageActive, updateStage } from "./actions";
import { StageRowItem } from "./stage-row";
import { AddStage } from "./add-stage";

export const metadata = { title: "Lifecycle stages" };

export default async function StagesPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id: matterTypeId } = await params;

  const matterType = await db.matterType.findUnique({
    where: { id: matterTypeId },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  if (!matterType) notFound();

  return (
    <>
      <Link href="/settings/matter-types" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-text-muted hover:text-text">
        <ArrowLeft className="size-3.5" /> Matter types
      </Link>
      <div className="mb-6">
        <h1 className="m-0 font-serif text-[22px] font-semibold">{matterType.name} — lifecycle stages</h1>
        <p className="mt-1 mb-0 text-[13px] text-text-muted">
          The order a matter moves through. Editing this applies to new matters only; existing matters keep the stage
          they&apos;re on (spec §5.13).
        </p>
      </div>
      <Card>
        <AddStage createAction={createStage.bind(null, matterTypeId)} />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr>
                <th className="border-b border-border px-4 py-2.5 text-left text-xs font-medium text-text-muted">#</th>
                <th className="border-b border-border px-4 py-2.5 text-left text-xs font-medium text-text-muted">Stage</th>
                <th className="border-b border-border px-4 py-2.5 text-left text-xs font-medium text-text-muted">Closure</th>
                <th className="border-b border-border px-4 py-2.5 text-left text-xs font-medium text-text-muted">Status</th>
                <th className="border-b border-border px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {matterType.stages.map((stage, i) => (
                <StageRowItem
                  key={stage.id}
                  stage={stage}
                  position={i + 1}
                  canMoveUp={i > 0}
                  canMoveDown={i < matterType.stages.length - 1}
                  updateAction={updateStage.bind(null, matterTypeId)}
                  toggleActiveAction={toggleStageActive.bind(null, matterTypeId, stage.id)}
                  deleteAction={deleteStage.bind(null, matterTypeId, stage.id)}
                  moveAction={moveStage.bind(null, matterTypeId, stage.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
