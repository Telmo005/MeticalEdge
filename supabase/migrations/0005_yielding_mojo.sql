CREATE TABLE "metical_edge"."pending_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid,
	"status" text DEFAULT 'aguardando_venda' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"capital_used_mzn" numeric(14, 2) NOT NULL,
	"buy_price" numeric(10, 4) NOT NULL,
	"usdt_amount" numeric(18, 8) NOT NULL,
	"target_sell_price" numeric(10, 4),
	"sell_price" numeric(10, 4),
	"mzn_received_gross" numeric(14, 2),
	"fees_paid_mzn" numeric(14, 2),
	"net_profit_mzn" numeric(14, 2),
	"finalized_at" timestamp with time zone,
	"trade_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "metical_edge"."pending_operations" ADD CONSTRAINT "pending_operations_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "metical_edge"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metical_edge"."pending_operations" ADD CONSTRAINT "pending_operations_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "metical_edge"."trades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pending_operations_status_idx" ON "metical_edge"."pending_operations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pending_operations_started_at_idx" ON "metical_edge"."pending_operations" USING btree ("started_at" DESC NULLS LAST);