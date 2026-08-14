/**
 * Módulo de arbitragem P2P internacional (USDT/NGN, USDT/BRL, ...) —
 * completamente separado do motor USDT/MZN em produção (lib/p2p/scan.ts,
 * lib/p2p/orderbook.ts): fiats diferentes, plataformas diferentes, tabelas
 * próprias. Ver .planning/PHASE1_PLAN.md e a nota de correcção em
 * STRATEGY.md (LocalBitcoins/Paxful → plataforma viva).
 */

/** Anúncio normalizado, neutro em fiat — equivalente ao `Ad` de
 *  lib/p2p/orderbook.ts, mas sem nomes de campo específicos de MZN. */
export type GenericAd = {
  externalId: string;
  side: "BUY" | "SELL";
  price: number;
  surplusAsset: number;
  minFiat: number;
  maxFiat: number;
  payMethods: string[];
  merchantId: string;
  merchantName: string;
  monthOrders: number | null;
  monthFinishRate: number | null;
  /** Se a plataforma expõe estado online/offline do anúncio, `false`
   *  significa "não filtrar por preço real" — em mercados finos (ex: Bybit
   *  KES/PEN além da primeira página) anúncios offline aparecem com preços
   *  fora da realidade e distorcem o melhor preço se não forem excluídos.
   *  `undefined` = plataforma não expõe o campo (assume-se negociável, como
   *  o Binance, que já só devolve anúncios activos). */
  isOnline?: boolean;
};

/** Uma fonte de anúncios P2P (Binance P2P, Bybit P2P, ...). Cada plataforma
 *  implementa isto contra a sua própria API pública. */
export interface P2PPlatformAdapter {
  /** Identificador estável, usado em DB e configuração (ex: "binance_p2p"). */
  readonly id: string;
  readonly label: string;
  fetchAds(asset: string, fiat: string, side: "BUY" | "SELL"): Promise<GenericAd[]>;
}
