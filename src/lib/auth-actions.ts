"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { writeAudit } from "./audit";
import { getCurrentUser } from "./session";

export async function signOutAction() {
  const user = await getCurrentUser();
  await auth.api.signOut({ headers: await headers(), asResponse: false });
  if (user) await writeAudit({ userId: user.id, action: "user.logout", entity: "User", entityId: user.id });
  redirect("/login");
}
