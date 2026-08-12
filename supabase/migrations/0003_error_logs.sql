CREATE TABLE "metical_edge"."error_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"message" text NOT NULL,
	"details" jsonb,
	"stack" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "metical_edge"."opportunities" ALTER COLUMN "detail" SET DEFAULT '{"buySteps":[],"sellSteps":[]}'::jsonb;--> statement-breakpoint
CREATE INDEX "error_logs_created_at_idx" ON "metical_edge"."error_logs" USING btree ("created_at" DESC NULLS LAST);
-- read_at / sms_alerts_enabled / alert_phone_e164 já foram adicionados pela
-- migração custom 0002 (escrita à mão, fora do fluxo `drizzle-kit generate`)
-- — o drizzle-kit re-gerou-os aqui só porque o snapshot anterior não sabia
-- deles. Removidos deste ficheiro para não tentar recriar colunas que já
-- existem na base de dados.

ALTER TABLE "metical_edge"."error_logs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "metical_edge"."error_logs" FROM anon, authenticated;