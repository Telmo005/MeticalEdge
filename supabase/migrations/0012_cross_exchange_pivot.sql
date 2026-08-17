-- Pivot: de arbitragem triangular numa só exchange (Binance) para arbitragem
-- cross-exchange (Binance + Bybit) com capital pré-distribuído nas duas,
-- nunca transferido durante a arbitragem. Escrita à mão (mesmo padrão de
-- 0008-0011: sem `drizzle-kit generate`). O `0012_arbitrage_pivot.sql`
-- anterior nunca chegou a ser commitado nem aplicado — este ficheiro
-- substitui-o directamente, usando DROP ... IF EXISTS para ficar seguro quer
-- essa versão tenha ou não sido aplicada manualmente por engano.

DROP TABLE IF EXISTS "metical_edge"."pending_operations";
--> statement-breakpoint
DROP TABLE IF EXISTS "metical_edge"."capital_ledger";
--> statement-breakpoint
DROP TABLE IF EXISTS "metical_edge"."alerts";
--> statement-breakpoint
DROP TABLE IF EXISTS "metical_edge"."trades";
--> statement-breakpoint
DROP TABLE IF EXISTS "metical_edge"."opportunities";
--> statement-breakpoint
DROP TABLE IF EXISTS "metical_edge"."snapshots";
--> statement-breakpoint
DROP TABLE IF EXISTS "metical_edge"."settings";
--> statement-breakpoint
DROP TABLE IF EXISTS "metical_edge"."bot_settings";
--> statement-breakpoint
DROP TABLE IF EXISTS "metical_edge"."bot_heartbeats";
--> statement-breakpoint

CREATE TABLE "metical_edge"."bot_settings" (
  "id" boolean PRIMARY KEY DEFAULT true,
  "initial_balance_usdt" numeric(18, 8) NOT NULL DEFAULT '0',
  "trade_size_pct" numeric(5, 2) NOT NULL DEFAULT '10.00',
  "max_trade_usdt" numeric(18, 8) NOT NULL DEFAULT '2.00000000',
  "min_profit_pct" numeric(6, 3) NOT NULL DEFAULT '0.100',
  "min_safety_margin_pct" numeric(6, 3) NOT NULL DEFAULT '0.150',
  "assumed_taker_fee_pct" numeric(6, 4) NOT NULL DEFAULT '0.1000',
  "max_execution_time_ms" integer NOT NULL DEFAULT 15000,
  "daily_loss_limit_usdt" numeric(18, 8) NOT NULL DEFAULT '1.00000000',
  "max_consecutive_errors" integer NOT NULL DEFAULT 3,
  "kill_switch_engaged" boolean NOT NULL DEFAULT false,
  "kill_switch_reason" text,
  "watched_pairs" text[] NOT NULL DEFAULT ARRAY['BTCUSDT','ETHUSDT'],
  "scanning_enabled" boolean NOT NULL DEFAULT true,
  "sms_alerts_enabled" boolean NOT NULL DEFAULT false,
  "alert_phone_e164" text,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE "metical_edge"."exchange_balances" (
  "exchange_id" text PRIMARY KEY,
  "usdt_free" numeric(18, 8) NOT NULL DEFAULT '0',
  "total_value_usdt" numeric(18, 8) NOT NULL DEFAULT '0',
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "exchange_balances_id_check" CHECK ("exchange_id" IN ('binance','bybit'))
);
--> statement-breakpoint

CREATE TABLE "metical_edge"."opportunities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "detected_at" timestamp with time zone NOT NULL DEFAULT now(),
  "pair" text NOT NULL,
  "buy_exchange" text NOT NULL,
  "sell_exchange" text NOT NULL,
  "buy_price" numeric(18, 8) NOT NULL,
  "sell_price" numeric(18, 8) NOT NULL,
  "quantity" numeric(18, 8) NOT NULL,
  "capital_usdt" numeric(18, 8) NOT NULL,
  "gross_spread_pct" numeric(8, 4),
  "fees_pct" numeric(8, 4),
  "estimated_slippage_pct" numeric(8, 4),
  "net_result_usdt" numeric(18, 8),
  "net_pct" numeric(8, 4),
  "liquidity_ok" boolean NOT NULL DEFAULT false,
  "passed_filters" boolean NOT NULL DEFAULT false,
  "reject_reasons" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "status" text NOT NULL DEFAULT 'detected',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "opportunities_buy_exchange_check" CHECK ("buy_exchange" IN ('binance','bybit')),
  CONSTRAINT "opportunities_sell_exchange_check" CHECK ("sell_exchange" IN ('binance','bybit')),
  CONSTRAINT "opportunities_status_check" CHECK ("status" IN ('detected','executed','rejected','expired'))
);
--> statement-breakpoint
CREATE INDEX "opportunities_detected_at_idx" ON "metical_edge"."opportunities" USING btree ("detected_at" DESC);
--> statement-breakpoint
CREATE INDEX "opportunities_status_idx" ON "metical_edge"."opportunities" USING btree ("status");
--> statement-breakpoint

CREATE TABLE "metical_edge"."trades" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "opportunity_id" uuid REFERENCES "metical_edge"."opportunities"("id") ON DELETE SET NULL,
  "started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "completed_at" timestamp with time zone,
  "pair" text NOT NULL,
  "buy_exchange" text NOT NULL,
  "sell_exchange" text NOT NULL,
  "buy_order_id" text,
  "sell_order_id" text,
  "buy_price" numeric(18, 8),
  "sell_price" numeric(18, 8),
  "quantity" numeric(18, 8) NOT NULL,
  "capital_usdt" numeric(18, 8) NOT NULL,
  "buy_fee_usdt" numeric(18, 8),
  "sell_fee_usdt" numeric(18, 8),
  "slippage_estimated_pct" numeric(8, 4),
  "slippage_real_pct" numeric(8, 4),
  "profit_theoretical_usdt" numeric(18, 8),
  "profit_estimated_usdt" numeric(18, 8),
  "profit_real_usdt" numeric(18, 8) NOT NULL DEFAULT '0',
  "outcome" text NOT NULL DEFAULT 'success',
  "error_message" text,
  "execution_time_ms" integer,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "trades_buy_exchange_check" CHECK ("buy_exchange" IN ('binance','bybit')),
  CONSTRAINT "trades_sell_exchange_check" CHECK ("sell_exchange" IN ('binance','bybit')),
  CONSTRAINT "trades_outcome_check" CHECK ("outcome" IN ('success','partial_recovered','failed'))
);
--> statement-breakpoint
CREATE INDEX "trades_started_at_idx" ON "metical_edge"."trades" USING btree ("started_at" DESC);
--> statement-breakpoint

CREATE TABLE "metical_edge"."capital_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "changed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "exchange_id" text NOT NULL,
  "delta_usdt" numeric(18, 8) NOT NULL,
  "reason" text NOT NULL,
  "trade_id" uuid REFERENCES "metical_edge"."trades"("id") ON DELETE SET NULL,
  "resulting_balance_usdt" numeric(18, 8) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "capital_ledger_exchange_id_check" CHECK ("exchange_id" IN ('binance','bybit'))
);
--> statement-breakpoint
CREATE INDEX "capital_ledger_changed_at_idx" ON "metical_edge"."capital_ledger" USING btree ("changed_at" DESC);
--> statement-breakpoint

CREATE TABLE "metical_edge"."alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "opportunity_id" uuid REFERENCES "metical_edge"."opportunities"("id") ON DELETE SET NULL,
  "sent_at" timestamp with time zone NOT NULL DEFAULT now(),
  "channel" text NOT NULL DEFAULT 'push',
  "kind" text NOT NULL DEFAULT 'execucao',
  "title" text NOT NULL,
  "body" text NOT NULL,
  "gateway_message_id" text,
  "delivery_error" text,
  "read_at" timestamp with time zone,
  CONSTRAINT "alerts_kind_check" CHECK ("kind" IN (
    'execucao','lucro','perda','erro','saldo_atualizado','bot_parado',
    'limite_perda','oportunidade_importante','teste'
  ))
);
--> statement-breakpoint
CREATE INDEX "alerts_sent_at_idx" ON "metical_edge"."alerts" USING btree ("sent_at" DESC);
--> statement-breakpoint
CREATE INDEX "alerts_kind_sent_at_idx" ON "metical_edge"."alerts" USING btree ("kind", "sent_at" DESC);
--> statement-breakpoint

CREATE TABLE "metical_edge"."bot_heartbeats" (
  "id" boolean PRIMARY KEY DEFAULT true,
  "at" timestamp with time zone NOT NULL DEFAULT now(),
  "opportunities_evaluated" integer NOT NULL DEFAULT 0,
  "best_net_pct" numeric(8, 4),
  "status" text NOT NULL DEFAULT 'scanning',
  "status_detail" text,
  "rebalance_recommended" boolean NOT NULL DEFAULT false,
  "rebalance_reason" text,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "bot_heartbeats_status_check" CHECK ("status" IN (
    'scanning','opportunity_found','validating','executing',
    'partially_filled','completed','recovery','paused','error'
  ))
);
--> statement-breakpoint

ALTER TABLE "metical_edge"."bot_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "metical_edge"."exchange_balances" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "metical_edge"."opportunities" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "metical_edge"."trades" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "metical_edge"."capital_ledger" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "metical_edge"."alerts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "metical_edge"."bot_heartbeats" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

REVOKE ALL ON ALL TABLES IN SCHEMA "metical_edge" FROM anon, authenticated;
--> statement-breakpoint

INSERT INTO "metical_edge"."bot_settings" ("id") VALUES (true) ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "metical_edge"."bot_heartbeats" ("id") VALUES (true) ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "metical_edge"."exchange_balances" ("exchange_id") VALUES ('binance'), ('bybit') ON CONFLICT DO NOTHING;
