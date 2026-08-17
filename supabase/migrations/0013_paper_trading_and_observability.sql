-- Paper trading (capital simulado, separado do real) + observabilidade
-- (detalhe de carteira por activo, saúde da ligação por exchange, log
-- granular por passo de execução). Escrita à mão (mesmo padrão de
-- 0008-0012).

ALTER TABLE "metical_edge"."bot_settings"
  ADD COLUMN IF NOT EXISTS "mode" text NOT NULL DEFAULT 'paper';
--> statement-breakpoint
ALTER TABLE "metical_edge"."bot_settings"
  ADD CONSTRAINT "bot_settings_mode_check" CHECK ("mode" IN ('paper', 'live'));
--> statement-breakpoint

ALTER TABLE "metical_edge"."exchange_balances"
  ADD COLUMN IF NOT EXISTS "assets_detail" jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "metical_edge"."paper_balances" (
  "exchange_id" text PRIMARY KEY,
  "usdt_free" numeric(18, 8) NOT NULL DEFAULT '10',
  "total_value_usdt" numeric(18, 8) NOT NULL DEFAULT '10',
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "paper_balances_id_check" CHECK ("exchange_id" IN ('binance', 'bybit'))
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "metical_edge"."exchange_health" (
  "exchange_id" text PRIMARY KEY,
  "last_success_at" timestamp with time zone,
  "last_error_at" timestamp with time zone,
  "last_error_message" text,
  "avg_latency_ms" integer,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "exchange_health_id_check" CHECK ("exchange_id" IN ('binance', 'bybit'))
);
--> statement-breakpoint

ALTER TABLE "metical_edge"."trades"
  ADD COLUMN IF NOT EXISTS "is_paper" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trades_is_paper_idx" ON "metical_edge"."trades" USING btree ("is_paper");
--> statement-breakpoint

ALTER TABLE "metical_edge"."capital_ledger"
  ADD COLUMN IF NOT EXISTS "is_paper" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "metical_edge"."trade_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "trade_id" uuid NOT NULL REFERENCES "metical_edge"."trades"("id") ON DELETE CASCADE,
  "at" timestamp with time zone NOT NULL DEFAULT now(),
  "event" text NOT NULL,
  "detail" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trade_events_trade_id_idx" ON "metical_edge"."trade_events" USING btree ("trade_id", "at");
--> statement-breakpoint

ALTER TABLE "metical_edge"."paper_balances" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "metical_edge"."exchange_health" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "metical_edge"."trade_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA "metical_edge" FROM anon, authenticated;
--> statement-breakpoint

INSERT INTO "metical_edge"."paper_balances" ("exchange_id") VALUES ('binance'), ('bybit') ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "metical_edge"."exchange_health" ("exchange_id") VALUES ('binance'), ('bybit') ON CONFLICT DO NOTHING;
