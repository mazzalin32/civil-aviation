"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEV_ROLE_COOKIE } from "@/lib/session";
import { homePathFor } from "@/components/app/nav-config";

const roleSchema = z.enum(["ADMIN", "LAWYER"]);

/** Dev-only: switch the placeholder role. Removed in Phase 1. */
export async function switchDevRole(formData: FormData) {
  if (process.env.NODE_ENV === "production") throw new Error("Not available in production");
  const role = roleSchema.parse(formData.get("role"));
  (await cookies()).set(DEV_ROLE_COOKIE, role, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect(homePathFor(role));
}
