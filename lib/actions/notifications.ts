"use server";

import { revalidatePath } from "next/cache";
import { eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { alerts } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export async function markAllAlertsReadAction() {
  await requireUser();
  await db.update(alerts).set({ readAt: new Date() }).where(isNull(alerts.readAt));
  revalidatePath("/", "layout");
}

export async function markAlertReadAction(id: string) {
  await requireUser();
  await db.update(alerts).set({ readAt: new Date() }).where(eq(alerts.id, id));
  revalidatePath("/", "layout");
}
