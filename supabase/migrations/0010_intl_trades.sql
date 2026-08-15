-- Registo manual de ciclos de arbitragem internacional executados —
-- equivalente a "trades" (USDT/MZN) mas para lib/p2p/intl/. Sem ledger de
-- capital automático como o MZN tem: aqui é só histórico para comparar
-- lucro real vs. estimado pelo scan, o capital em settings.intl_capital_usd
-- continua a ajustar-se manualmente em /settings.

CREATE TABLE IF NOT EXISTS "metical_edge"."intl_trades" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "pair" text NOT NULL,
  "region" text NOT NULL,
  "platform_buy" text NOT NULL,
  "platform_sell" text NOT NULL,
  "buy_price" numeric(18, 4) NOT NULL,
  "sell_price" numeric(18, 4) NOT NULL,
  "capital_used_usd" numeric(14, 2) NOT NULL,
  "fees_paid_usd" numeric(14, 2) DEFAULT '0' NOT NULL,
  "net_profit_usd" numeric(14, 2) NOT NULL,
  "notes" text,
  "executed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intl_trades_executed_at_idx"
  ON "metical_edge"."intl_trades" USING btree ("executed_at" DESC NULLS LAST);
