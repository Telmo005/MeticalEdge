ALTER TABLE "metical_edge"."settings"
  ADD COLUMN "sms_alerts_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN "alert_phone_e164" text;

ALTER TABLE "metical_edge"."alerts"
  ADD COLUMN "read_at" timestamp with time zone;
