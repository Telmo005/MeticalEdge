-- Limiar de alerta em lucro LÍQUIDO.
--
-- O segundo gatilho de notificação comparava o lucro BRUTO com
-- min_display_profit_mzn (um parâmetro que existe para filtrar listas, não
-- para decidir alertas). Resultado: chegavam avisos de oportunidades que,
-- depois das taxas da Binance e das transferências, davam prejuízo.
--
-- Este limiar é sobre o líquido e tem 0 por omissão: avisa sempre que sobrar
-- dinheiro real depois de todos os custos.

ALTER TABLE "metical_edge"."settings"
  ADD COLUMN IF NOT EXISTS "min_net_profit_alert_mzn" numeric(14, 2) DEFAULT '0' NOT NULL;
