import { eq } from "drizzle-orm";
import { db } from "@/db";
import { alerts, botHeartbeats, botSettings } from "@/db/schema";
import { sendPush } from "@/lib/messaging-client";

/** Sem `import "server-only"` (mesmo motivo de `lib/errorLog.core.ts`) —
 *  usado tanto pelo worker (`tsx`, fora do bundler do Next.js) como por
 *  `lib/execution/executor.ts`. Pára novas operações quase de imediato: o
 *  worker verifica `killSwitchEngaged` a cada iteração do loop. */
export async function engageKillSwitch(reason: string) {
  await db
    .update(botSettings)
    .set({ killSwitchEngaged: true, killSwitchReason: reason, updatedAt: new Date() })
    .where(eq(botSettings.id, true));

  await db.insert(alerts).values({ kind: "limite_perda", title: "Kill switch accionado", body: reason });
  await sendPush("Bot parado automaticamente", reason);

  await db
    .update(botHeartbeats)
    .set({ status: "paused", statusDetail: reason, at: new Date(), updatedAt: new Date() })
    .where(eq(botHeartbeats.id, true));
}
