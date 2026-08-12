CREATE SCHEMA "metical_edge";
--> statement-breakpoint
CREATE TABLE "metical_edge"."alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"channel" text DEFAULT 'push' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"gateway_message_id" text,
	"delivery_error" text
);
--> statement-breakpoint
CREATE TABLE "metical_edge"."capital_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delta_mzn" numeric(14, 2) NOT NULL,
	"reason" text NOT NULL,
	"trade_id" uuid,
	"resulting_balance_mzn" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metical_edge"."opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"capital_mzn" numeric(14, 2) NOT NULL,
	"buy_vwap" numeric(10, 4),
	"sell_vwap" numeric(10, 4),
	"usdt_amount" numeric(18, 8),
	"gross_profit_mzn" numeric(14, 2),
	"gross_pct" numeric(8, 4),
	"n_orders" integer,
	"residual_usdt" numeric(18, 8) DEFAULT '0' NOT NULL,
	"net_profit_conservative_mzn" numeric(14, 2),
	"net_profit_medium_mzn" numeric(14, 2),
	"net_profit_optimistic_mzn" numeric(14, 2),
	"net_pct_conservative" numeric(8, 4),
	"net_pct_medium" numeric(8, 4),
	"net_pct_optimistic" numeric(8, 4),
	"meets_entry_rules" boolean DEFAULT false NOT NULL,
	"reasons_blocked" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'detected' NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metical_edge"."settings" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"current_capital_mzn" numeric(14, 2) DEFAULT '0' NOT NULL,
	"initial_capital_mzn" numeric(14, 2) DEFAULT '0' NOT NULL,
	"min_net_pct_alert" numeric(6, 3) DEFAULT '0.15' NOT NULL,
	"min_gross_spread_pct" numeric(6, 3) DEFAULT '0.6' NOT NULL,
	"min_counterparty_finish_rate" numeric(5, 4) DEFAULT '0.95' NOT NULL,
	"min_counterparty_monthly_orders" integer DEFAULT 50 NOT NULL,
	"max_orders_per_leg" integer DEFAULT 3 NOT NULL,
	"alert_cooldown_minutes" integer DEFAULT 20 NOT NULL,
	"scanning_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metical_edge"."snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"best_ask" numeric(10, 4),
	"best_bid" numeric(10, 4),
	"mid_price" numeric(10, 4),
	"spread_pct" numeric(8, 4),
	"is_crossed" boolean DEFAULT false NOT NULL,
	"n_ads_ask" integer DEFAULT 0 NOT NULL,
	"n_ads_bid" integer DEFAULT 0 NOT NULL,
	"liquidity_ask_usdt" numeric(18, 4),
	"liquidity_bid_usdt" numeric(18, 4),
	"reference_usd_mzn" numeric(10, 4),
	"ask_ads" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bid_ads" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metical_edge"."trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"capital_used_mzn" numeric(14, 2) NOT NULL,
	"buy_price" numeric(10, 4),
	"sell_price" numeric(10, 4),
	"usdt_amount" numeric(18, 8),
	"gross_profit_mzn" numeric(14, 2),
	"fees_paid_mzn" numeric(14, 2) DEFAULT '0' NOT NULL,
	"net_profit_mzn" numeric(14, 2) NOT NULL,
	"outcome" text DEFAULT 'success' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "metical_edge"."alerts" ADD CONSTRAINT "alerts_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "metical_edge"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metical_edge"."capital_ledger" ADD CONSTRAINT "capital_ledger_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "metical_edge"."trades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metical_edge"."opportunities" ADD CONSTRAINT "opportunities_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "metical_edge"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metical_edge"."trades" ADD CONSTRAINT "trades_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "metical_edge"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_sent_at_idx" ON "metical_edge"."alerts" USING btree ("sent_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "capital_ledger_changed_at_idx" ON "metical_edge"."capital_ledger" USING btree ("changed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "opportunities_detected_at_idx" ON "metical_edge"."opportunities" USING btree ("detected_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "opportunities_status_idx" ON "metical_edge"."opportunities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "snapshots_collected_at_idx" ON "metical_edge"."snapshots" USING btree ("collected_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "trades_executed_at_idx" ON "metical_edge"."trades" USING btree ("executed_at" DESC NULLS LAST);