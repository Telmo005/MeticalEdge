-- Robustez P0 (roteiro de melhorias): perda máxima por operação, perdas
-- consecutivas, idempotência (client order IDs), estado persistente entre
-- pernas, e lock por lease entre instâncias do worker. Escrita à mão
-- (mesmo padrão de 0008-0013).

ALTER TABLE "metical_edge"."bot_settings"
  ADD COLUMN IF NOT EXISTS "max_trade_loss_usdt" numeric(18, 8) NOT NULL DEFAULT '1.00000000';
--> statement-breakpoint
ALTER TABLE "metical_edge"."bot_settings"
  ADD COLUMN IF NOT EXISTS "max_consecutive_losses" integer NOT NULL DEFAULT 3;
--> statement-breakpoint

ALTER TABLE "metical_edge"."bot_heartbeats"
  ADD COLUMN IF NOT EXISTS "consecutive_losses" integer NOT NULL DEFAULT 0;
--> statement-breakpoint

ALTER TABLE "metical_edge"."trades"
  ADD COLUMN IF NOT EXISTS "buy_client_order_id" text;
--> statement-breakpoint
ALTER TABLE "metical_edge"."trades"
  ADD COLUMN IF NOT EXISTS "sell_client_order_id" text;
--> statement-breakpoint
ALTER TABLE "metical_edge"."trades"
  DROP CONSTRAINT IF EXISTS "trades_outcome_check";
--> statement-breakpoint
ALTER TABLE "metical_edge"."trades"
  ADD CONSTRAINT "trades_outcome_check" CHECK ("outcome" IN ('in_progress', 'success', 'partial_recovered', 'failed'));
--> statement-breakpoint
ALTER TABLE "metical_edge"."trades"
  ALTER COLUMN "outcome" SET DEFAULT 'in_progress';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "metical_edge"."worker_lock" (
  "id" boolean PRIMARY KEY DEFAULT true,
  "holder_id" text,
  "heartbeat_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "metical_edge"."worker_lock" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA "metical_edge" FROM anon, authenticated;
--> statement-breakpoint
INSERT INTO "metical_edge"."worker_lock" ("id") VALUES (true) ON CONFLICT DO NOTHING;
