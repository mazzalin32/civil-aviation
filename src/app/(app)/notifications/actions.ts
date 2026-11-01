"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  return user;
}

export async function getUnreadNotificationCount(): Promise<number> {
  const user = await requireUser();
  return db.notification.count({ where: { userId: user.id, readAt: null } });
}

export type NotificationItem = {
  id: string;
  type: string;
  message: string;
  url: string | null;
  readAt: string | null;
  createdAt: string;
};

export async function getNotifications(): Promise<NotificationItem[]> {
  const user = await requireUser();
  const rows = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, type: true, message: true, url: true, readAt: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, readAt: r.readAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString() }));
}

export async function markNotificationRead(id: string) {
  const user = await requireUser();
  await db.notification.updateMany({ where: { id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}
