-- Remove a arbitragem P2P internacional — decisão do utilizador de voltar a
-- concentrar tudo no motor USDT/MZN, depois de confirmar (com dados reais)
-- que o internacional estava bloqueado por falta de acesso a pagamentos
-- locais estrangeiros. Nunca houve capital real nem execução nesta frente,
-- só recolha de dados para validação — seguro remover por completo.

DROP TABLE IF EXISTS "metical_edge"."intl_trades";
--> statement-breakpoint
DROP TABLE IF EXISTS "metical_edge"."intl_opportunities";
--> statement-breakpoint
ALTER TABLE "metical_edge"."settings"
  DROP COLUMN IF EXISTS "intl_capital_usd";
