import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessMatterChat } from "@/lib/authz";
import { db } from "@/lib/db";
import { chatEventBus } from "@/lib/chat/event-bus";
import { sseResponse } from "@/lib/sse";

export const dynamic = "force-dynamic";

/** Live updates for one case's discussion — only for people who can open that chat. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matterId } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const matter = await db.matter.findUnique({ where: { id: matterId }, select: { organizationId: true } });
  if (!matter || matter.organizationId !== user.organizationId) return new NextResponse("Not found", { status: 404 });

  const allowed = await canAccessMatterChat(user.id, user.role, matterId);
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  return sseResponse(request, (send) => chatEventBus.subscribe(matterId, (event) => send(event.type, event.data)));
}
