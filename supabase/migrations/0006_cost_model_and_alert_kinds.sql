-- Modelo de custo real + separação de cooldown por tipo de alerta.
--
-- 1. settings: preferências de custo do dinheiro móvel. As tabelas de taxas
--    do M-Pesa/e-Mola já existiam em lib/p2p/fees.ts mas nunca eram
--    chamadas — o lucro mostrado ignorava o custo de mover Meticais.
-- 2. alerts.kind: o cooldown era partilhado por todos os avisos, por isso
--    um sinal de preço podia engolir o alerta de oportunidade seguinte.

ALTER TABLE "metical_edge"."settings"
  ADD COLUMN IF NOT EXISTS "cost_rail" text DEFAULT 'mpesa' NOT NULL;
--> statement-breakpoint
ALTER TABLE "metical_edge"."settings"
  ADD COLUMN IF NOT EXISTS "include_cash_out" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "metical_edge"."settings"
  ADD COLUMN IF NOT EXISTS "transfers_per_order" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "metical_edge"."settings"
  DROP CONSTRAINT IF EXISTS "settings_cost_rail_check";
--> statement-breakpoint
ALTER TABLE "metical_edge"."settings"
  ADD CONSTRAINT "settings_cost_rail_check" CHECK ("cost_rail" IN ('nenhum', 'mpesa', 'emola'));
--> statement-breakpoint
ALTER TABLE "metical_edge"."settings"
  DROP CONSTRAINT IF EXISTS "settings_transfers_per_order_check";
--> statement-breakpoint
ALTER TABLE "metical_edge"."settings"
  ADD CONSTRAINT "settings_transfers_per_order_check" CHECK ("transfers_per_order" BETWEEN 1 AND 10);
--> statement-breakpoint
ALTER TABLE "metical_edge"."alerts"
  ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'oportunidade' NOT NULL;
--> statement-breakpoint
ALTER TABLE "metical_edge"."alerts"
  DROP CONSTRAINT IF EXISTS "alerts_kind_check";
--> statement-breakpoint
ALTER TABLE "metical_edge"."alerts"
  ADD CONSTRAINT "alerts_kind_check"
  CHECK ("kind" IN ('oportunidade', 'sinal_preco', 'operacao_pendente', 'teste'));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alerts_kind_sent_at_idx"
  ON "metical_edge"."alerts" USING btree ("kind", "sent_at" DESC NULLS LAST);
