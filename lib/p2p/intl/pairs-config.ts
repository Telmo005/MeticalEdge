/**
 * Pares/regiões alvo da Fase 1 (STRATEGY.md secção 2), com a plataforma de
 * origem (sempre Binance P2P — cobertura global, cliente já existe) e a
 * plataforma de destino por região.
 *
 * Segunda plataforma: Bybit P2P (endpoint público confirmado live,
 * 2026-08-14 — ver lib/p2p/intl/bybit-adapter.ts). OKX P2P ficou de fora
 * por agora: o endpoint existe mas está atrás de protecção anti-bot que só
 * tem uma implementação de referência conhecida a lidar com 403s — não
 * vale o risco de fiabilidade para a Fase 1. MEXC/KuCoin por confirmar
 * depois se for preciso um terceiro ponto de comparação.
 */
import { binanceP2PAdapter } from "./binance-adapter";
import { bybitP2PAdapter } from "./bybit-adapter";
import type { P2PPlatformAdapter } from "./types";

export type PairConfig = {
  asset: string;
  fiat: string;
  pairLabel: string; // "USDT/NGN"
  region: string;
  platformBuy: P2PPlatformAdapter;
  platformSell: P2PPlatformAdapter | null;
};

/** Capital agora é configurável em /settings (settings.intl_capital_usd) —
 *  ver lib/p2p/intl/scan.ts, que o lê da BD a cada varredura. */

/** Estimativa Fase 1 — substituída por custos reais medidos na Fase 2. */
export const DEFAULT_COSTS_PCT = { buyPct: 0.015, sellPct: 0.02 };
export const MIN_NET_PCT_VIABLE = 1;

/**
 * Acima disto, o spread deixa de ser "boa oportunidade" e passa a "verificar
 * antes de confiar" — visto ao vivo em mercados finos (Bybit KES/PEN/ARS):
 * um único anúncio de um comerciante bem cotado a pagar muito acima do
 * mercado tanto pode ser uma oportunidade real como o padrão clássico de
 * burla P2P (paga-te acima do mercado para te convencer a libertar a cripto
 * antes da confirmação real do pagamento, depois estorna). Não escondemos —
 * só deixamos de apresentar como certeza.
 */
export const SUSPICIOUS_NET_PCT_THRESHOLD = 15;

/** Pares activos — Binance P2P e Bybit P2P testados ao vivo com anúncios
 *  reais dos dois lados em cada um (2026-08-14 e 2026-08-15). O motor de
 *  scan testa as duas direcções (Binance→Bybit e Bybit→Binance) para cada
 *  par — mais pares activos = mais hipóteses de apanhar uma oportunidade
 *  real num dado momento, sem adicionar mais plataformas (mantém simples). */
export const TARGET_PAIRS: PairConfig[] = [
  { asset: "USDT", fiat: "KES", pairLabel: "USDT/KES", region: "Quénia", platformBuy: binanceP2PAdapter, platformSell: bybitP2PAdapter },
  { asset: "USDT", fiat: "PEN", pairLabel: "USDT/PEN", region: "Peru", platformBuy: binanceP2PAdapter, platformSell: bybitP2PAdapter },
  { asset: "USDT", fiat: "VND", pairLabel: "USDT/VND", region: "Vietname", platformBuy: binanceP2PAdapter, platformSell: bybitP2PAdapter },
  { asset: "USDT", fiat: "INR", pairLabel: "USDT/INR", region: "Índia", platformBuy: binanceP2PAdapter, platformSell: bybitP2PAdapter },
  { asset: "USDT", fiat: "PHP", pairLabel: "USDT/PHP", region: "Filipinas", platformBuy: binanceP2PAdapter, platformSell: bybitP2PAdapter },
  { asset: "USDT", fiat: "EGP", pairLabel: "USDT/EGP", region: "Egipto", platformBuy: binanceP2PAdapter, platformSell: bybitP2PAdapter },
  { asset: "USDT", fiat: "PKR", pairLabel: "USDT/PKR", region: "Paquistão", platformBuy: binanceP2PAdapter, platformSell: bybitP2PAdapter },
  { asset: "USDT", fiat: "COP", pairLabel: "USDT/COP", region: "Colômbia", platformBuy: binanceP2PAdapter, platformSell: bybitP2PAdapter },
  { asset: "USDT", fiat: "ARS", pairLabel: "USDT/ARS", region: "Argentina", platformBuy: binanceP2PAdapter, platformSell: bybitP2PAdapter },
  { asset: "USDT", fiat: "ZAR", pairLabel: "USDT/ZAR", region: "África do Sul", platformBuy: binanceP2PAdapter, platformSell: bybitP2PAdapter },
];

/**
 * Pares retirados da lista activa — Binance P2P devolve ZERO anúncios para
 * os dois, confirmado por duas fontes independentes em 2026-08-14:
 *
 * - USDT/NGN: a Binance suspendeu TODOS os serviços de Naira (incluindo
 *   P2P) em Fevereiro/2024. Continua suspenso em Agosto/2026, sem
 *   indicação de retoma (processo de $79.5 mil milhões contra a Binance
 *   ainda em litígio). Confirmado por notícia + teste directo à API.
 * - USDT/BRL: sem confirmação por notícia de banimento formal, mas o
 *   agregador independente p2p.army (não relacionado com o ambiente de
 *   teste desta app) também não mostra nenhum anúncio Binance BRL neste
 *   momento — não é um artefacto de IP/geo-bloqueio do lado deste código,
 *   é a Binance a não ter livro activo neste par agora.
 *
 * Mantidos aqui (fora de TARGET_PAIRS, portanto o cron nunca lhes toca)
 * para não perder o trabalho de mapeamento caso valha a pena reactivar com
 * OUTRA plataforma de origem (nenhuma das duas pode usar Binance como
 * `platformBuy` enquanto isto não mudar) — precisaria de uma pesquisa de
 * plataforma dedicada, não só ligar o Bybit como está feito para KES/PEN.
 */
export const INACTIVE_PAIRS: { asset: string; fiat: string; pairLabel: string; region: string; reason: string }[] = [
  { asset: "USDT", fiat: "NGN", pairLabel: "USDT/NGN", region: "Nigéria", reason: "Binance suspendeu P2P NGN em Fev/2024, sem retoma" },
  { asset: "USDT", fiat: "BRL", pairLabel: "USDT/BRL", region: "Brasil", reason: "Binance sem anúncios activos neste par (confirmado via p2p.army)" },
];
