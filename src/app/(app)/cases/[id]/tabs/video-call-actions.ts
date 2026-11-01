"use server";

import { AccessToken } from "livekit-server-sdk";
import { requireMatterChatAccess } from "@/lib/authz";
import { env } from "@/lib/env";
import { writeAudit } from "@/lib/audit";

export type VideoCallCredentials = { url: string; token: string; roomName: string } | { error: string };

/** One LiveKit room per matter — same permission boundary as case chat (assigned
 *  lawyers + Admin only), since a video call is an extension of the case discussion. */
export async function getVideoCallCredentials(matterId: string): Promise<VideoCallCredentials> {
  if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
    return { error: "Video calls aren't configured for this deployment." };
  }
  const user = await requireMatterChatAccess(matterId);

  const roomName = `matter-${matterId}`;
  const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: user.id,
    name: user.name,
    ttl: "4h",
  });
  token.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });

  await writeAudit({ userId: user.id, action: "matter.videoCall.join", entity: "Matter", entityId: matterId });

  return { url: env.LIVEKIT_URL, token: await token.toJwt(), roomName };
}
