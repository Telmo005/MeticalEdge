import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// DATABASE_URL deve apontar para o TRANSACTION pooler do Supabase (porta
// 6543), não o session pooler (5432) — mesma razão que no Duelo: cada
// função serverless do Vercel abre o seu próprio pool, e o session pooler
// limita o projecto inteiro a poucas ligações simultâneas. `prepare: false`
// é obrigatório em modo transaction-pooler (sem prepared statements entre
// ligações agrupadas).
const connectionString = process.env.DATABASE_URL!;

// Em dev, o hot-reload do Next.js recarrega este módulo a cada alteração —
// sem cache em globalThis, cada reload abriria um pool novo sem fechar o
// anterior.
const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql };

const client =
  globalForDb.pgClient ?? postgres(connectionString, { prepare: false, max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });
