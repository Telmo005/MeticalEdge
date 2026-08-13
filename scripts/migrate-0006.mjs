/**
 * Corre a migração 0006 directamente contra a base de dados, usando o
 * DATABASE_URL do .env. Existe porque o resto do projecto assume que as
 * migrações são coladas à mão no SQL Editor do Supabase — o que é fácil de
 * esquecer, e uma coluna em falta aqui não dá erro de compilação, dá erro
 * em produção a meio de uma varredura.
 *
 * Correr com:  node --env-file=.env scripts/migrate-0006.mjs
 *
 * É seguro correr mais do que uma vez: todas as instruções usam
 * IF NOT EXISTS / DROP ... IF EXISTS.
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL. Corre com: node --env-file=.env scripts/migrate-0006.mjs");
  process.exit(1);
}

const file = path.join(process.cwd(), "supabase/migrations/0006_cost_model_and_alert_kinds.sql");
const statements = fs
  .readFileSync(file, "utf8")
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.split("\n").every((l) => l.trim().startsWith("--")));

const sql = postgres(url, { prepare: false, ssl: "require", max: 1 });

try {
  for (const [i, stmt] of statements.entries()) {
    await sql.unsafe(stmt);
    const label = stmt
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join(" ")
      .replace(/\s+/g, " ")
      .slice(0, 90);
    console.log(`ok  ${i + 1}/${statements.length}  ${label}`);
  }

  const cols = await sql`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'metical_edge'
      and column_name in ('cost_rail', 'include_cash_out', 'transfers_per_order', 'kind')
    order by table_name, column_name`;

  console.log("\nColunas presentes:");
  for (const c of cols) console.log(`  metical_edge.${c.table_name}.${c.column_name}`);
  if (cols.length < 4) console.warn("\nAviso: esperava 4 colunas, encontrei", cols.length);
} catch (e) {
  console.error("ERRO:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
