-- Complementa 0000_tough_misty_knight.sql (gerado pelo drizzle-kit a partir
-- de db/schema.ts) com o que o Drizzle não expressa: CHECK constraints para
-- os enums de texto, RLS sem policies (nega tudo ao PostgREST por omissão —
-- ver nota em db/schema.ts sobre porquê esta app não usa RLS/PostgREST para
-- dados, só ligação directa Postgres), e a linha única de settings.

ALTER TABLE "metical_edge"."opportunities"
  ADD CONSTRAINT "opportunities_status_check"
  CHECK ("status" IN ('detected','alerted','expired','traded','dismissed'));

ALTER TABLE "metical_edge"."trades"
  ADD CONSTRAINT "trades_outcome_check"
  CHECK ("outcome" IN ('success','partial','loss'));

ALTER TABLE "metical_edge"."settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "metical_edge"."snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "metical_edge"."opportunities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "metical_edge"."alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "metical_edge"."trades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "metical_edge"."capital_ledger" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA "metical_edge" FROM anon, authenticated;
REVOKE ALL ON SCHEMA "metical_edge" FROM anon, authenticated;

INSERT INTO "metical_edge"."settings" (id) VALUES (true) ON CONFLICT DO NOTHING;
