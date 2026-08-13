/**
 * Corre as migrações SQL directamente contra a base de dados, usando o
 * DATABASE_URL do .env. Existe porque o resto do projecto assume que as
 * migrações são coladas à mão no SQL Editor do Supabase — o que é fácil de
 * esquecer, e uma coluna em falta aqui não dá erro de compilação, dá erro em
 * produção a meio de uma varredura.
 *
 *   node --env-file=.env scripts/migrate.mjs            # corre a partir da 0006
 *   node --env-file=.env scripts/migrate.mjs 0007       # corre só essa
 *
 * Só aplica ficheiros a partir da 0006 por omissão: as anteriores foram
 * criadas antes deste script existir e já estão aplicadas — algumas nem são
 * idempotentes (CREATE TABLE sem IF NOT EXISTS), por isso repeti-las daria
 * erro. As migrações novas são todas escritas com IF NOT EXISTS, o que torna
 * seguro correr isto as vezes que forem precisas.
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const FIRST_IDEMPOTENT_MIGRATION = "0006";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL. Corre com: node --env-file=.env scripts/migrate.mjs");
  process.exit(1);
}

const dir = path.join(process.cwd(), "supabase/migrations");
const only = process.argv[2];

const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .filter((f) => (only ? f.startsWith(only) : f.slice(0, 4) >= FIRST_IDEMPOTENT_MIGRATION))
  .sort();

if (files.length === 0) {
  console.error(only ? `Nenhuma migração começa por "${only}".` : "Nenhuma migração para correr.");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, ssl: "require", max: 1 });

try {
  for (const file of files) {
    const statements = fs
      .readFileSync(path.join(dir, file), "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.split("\n").every((l) => l.trim().startsWith("--")));

    console.log(`\n${file}  (${statements.length} instruções)`);
    for (const [i, stmt] of statements.entries()) {
      await sql.unsafe(stmt);
      const label = stmt
        .split("\n")
        .filter((l) => !l.trim().startsWith("--"))
        .join(" ")
        .replace(/\s+/g, " ")
        .slice(0, 88);
      console.log(`  ok ${i + 1}/${statements.length}  ${label}`);
    }
  }

  const cols = await sql`
    select column_name
    from information_schema.columns
    where table_schema = 'metical_edge' and table_name = 'settings'
      and column_name in ('cost_rail', 'include_cash_out', 'transfers_per_order', 'min_net_profit_alert_mzn')
    order by column_name`;
  console.log("\nColunas de settings presentes:");
  for (const c of cols) console.log(`  ${c.column_name}`);
} catch (e) {
  console.error("\nERRO:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
