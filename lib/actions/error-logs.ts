"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { errorLogs } from "@/db/schema";
import { requireUser } from "@/lib/auth";

/** Apaga todos os erros registados — usado depois de confirmar que um
 *  problema já foi resolvido, para a lista não ficar cheia de ruído antigo. */
export async function clearErrorLogsFormAction() {
  await requireUser();
  await db.delete(errorLogs);
  revalidatePath("/settings");
}
