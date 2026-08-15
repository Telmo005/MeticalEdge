-- Capital configurável para a arbitragem P2P internacional — até aqui
-- estava fixo em código (30.000 USD, lib/p2p/intl/pairs-config.ts), sem
-- forma de o utilizador ajustar ao capital real disponível. Segue o mesmo
-- padrão do capital MZN em settings.current_capital_mzn.

ALTER TABLE "metical_edge"."settings"
  ADD COLUMN IF NOT EXISTS "intl_capital_usd" numeric(14, 2) DEFAULT '30000' NOT NULL;
