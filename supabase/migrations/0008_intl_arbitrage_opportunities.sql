-- Arbitragem P2P internacional (Fase 1 — validação de mercado).
--
-- Tabela nova e independente do motor USDT/MZN em produção (snapshots,
-- opportunities, settings acima): fiats diferentes (NGN, BRL, KES, ...),
-- plataformas diferentes por par, sem capital real nem execução nesta
-- fase — só recolha de spreads entre duas plataformas P2P para o mesmo
-- par/fiat. Ver .planning/PHASE1_PLAN.md e a nota de correcção em
-- STRATEGY.md (LocalBitcoins/Paxful, que encerraram, substituídos por
-- plataforma viva).

CREATE TABLE IF NOT EXISTS "metical_edge"."intl_opportunities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "pair" text NOT NULL,
  "region" text NOT NULL,
  "platform_buy" text NOT NULL,
  "platform_sell" text NOT NULL,
  "best_ask" numeric(18, 4),
  "best_bid" numeric(18, 4),
  "spread_gross_pct" numeric(8, 4),
  "spread_net_pct" numeric(8, 4),
  "capital_usd" numeric(14, 2) NOT NULL,
  "profit_at_capital_usd" numeric(14, 2),
  "is_viable" boolean DEFAULT false NOT NULL,
  "n_ads_buy" integer DEFAULT 0 NOT NULL,
  "n_ads_sell" integer DEFAULT 0 NOT NULL,
  "raw" jsonb,
  "collected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intl_opportunities_pair_collected_at_idx"
  ON "metical_edge"."intl_opportunities" USING btree ("pair", "collected_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intl_opportunities_viable_collected_at_idx"
  ON "metical_edge"."intl_opportunities" USING btree ("is_viable", "collected_at" DESC NULLS LAST);
