# 🌍 Arbitragem P2P Internacional — Estratégia Operacional

**Data:** 2026-08-14  
**Status:** ATIVO  
**Capital Operacional Recomendado:** $10,000+ USD  
**ROI Esperado (Mês 3):** 50-100%  

---

> ⚠️ **CORREÇÃO (2026-08-14):** Este documento assume o **LocalBitcoins** como
> plataforma para a segunda perna de cada ciclo (e o **Paxful** aparece
> implicitamente como alternativa). Verificámos: **LocalBitcoins encerrou o
> P2P em Fev/2023** e o **Paxful encerrou operações em Nov/2025** — nenhum
> dos dois tem a liquidez que este documento assume nos pares USDT/NGN,
> USDT/BRL, etc.
>
> **Substituto decidido:** onde quer que este documento diga "LocalBitcoins"
> ou "Paxful" (nomes de classes, endpoints, tabela da Secção 2, modelo de
> custos da Secção 3-4), ler como a segunda plataforma P2P viva com
> liquidez real na região — candidatas confirmadas como activas em 2026:
> **Bybit P2P**, **OKX P2P**, **MEXC P2P**, **KuCoin P2P**. A escolha exacta
> por par/região e os endpoints técnicos ficam confirmados depois de
> pesquisa focada (em curso); os números de spread/custo desta versão são
> apenas indicativos até essa validação.
>
> Também importante: `lib/p2p/binance-client.ts` já existe nesta app e já é
> genérico em `fiat` — os exemplos de código da Secção 5 que reescrevem um
> `BinanceP2PClient` do zero são redundantes, reusar o cliente actual.

---

> 🚨 **ACHADO CRÍTICO (2026-08-14, testado ao vivo):** O par **#1 desta
> tabela — USDT/NGN — é IMPOSSÍVEL via Binance P2P.** A Binance suspendeu
> **todos** os serviços de Naira (incluindo P2P) em Fevereiro/2024 e
> continua suspenso em Agosto/2026 (sem indicação de retoma; processo de
> $79.5 mil milhões contra a Binance ainda em litígio). Testei directamente
> o endpoint público `c2c/adv/search` com `fiat=NGN` e devolve **zero
> anúncios**, dos dois lados — consistente com a notícia. Enquanto a
> Binance não voltar a operar NGN, este par não pode usar Binance como
> plataforma de origem; teria de ser inteiramente noutra plataforma dos
> dois lados (Bybit P2P + outra), o que muda todo o modelo de custos e
> risco da Secção 3-4 para este par especificamente.
>
> **USDT/BRL também devolveu zero anúncios** no mesmo teste (Binance
> `fiat=BRL`, ambos os lados), sem confirmação por notícia de banimento —
> pode ser geo-bloqueio específico do IP a partir do qual testei, não uma
> suspensão confirmada. Precisa de verificação manual (ex: abrir
> p2p.binance.com/pt-BR a partir de um IP brasileiro, ou correr o scan já
> implementado a partir do ambiente de produção) antes de confiar neste
> par.
>
> **USDT/KES e USDT/PEN funcionam** nos dois lados (Binance + Bybit P2P) e
> mostram spreads brutos reais de 10-18% — mas com anúncios "online" e de
> comerciantes bem cotados a pagar muito acima do preço de mercado (ex:
> 150 KES/USDT quando o resto do livro está a ~129-135), o que tanto pode
> ser uma oportunidade real como o padrão clássico de burla P2P (comprador
> paga-te acima do mercado para te convencer a libertar a cripto antes da
> confirmação real do pagamento, depois estorna). O painel `/arbitragem-intl`
> mostra os anúncios em bruto (nome do comerciante, nº de ordens, taxa de
> conclusão) precisamente para permitires essa verificação humana — os
> números desta fase são candidatos a validar numa semana de observação
> (Task 1.4 do PHASE1_PLAN.md), não spreads confirmados executáveis.

---

## 1. EXECUTIVE SUMMARY

O projeto **metical-edge** foi um monitor de arbitragem P2P localmente (USDT/MZN no Binance P2P). 
Falhou porque: **spreads muito pequenos (0.2-0.5%) + custos operacionais altos (M-Pesa, e-Mola)**.

**Novo pivô:** Arbitragem P2P **internacional** com foco em pares de moedas de alta demanda onde:
- Spreads são **2-8%** (vs 0.2-0.5% localmente)
- Custos são **2-3%** (vs 4-5% localmente)
- Lucro líquido esperado: **0.5-3% por ciclo**

**Meta Mês 1:** Validar 5+ ciclos com capital real ($5,000 USD).  
**Meta Mês 3:** Automatizar pipeline completo, atingir 50-100 ciclos/mês com $10,000 USD operacional.

---

## 2. TOP 5 PARES DE ARBITRAGEM (RANKING) — ⚠️ ver estado real abaixo

| Rank | Par | Regiões | Spread | Volume | Tempo Ciclo | ROI/Ciclo | Notas |
|------|-----|---------|--------|--------|------------|-----------|-------|
| ~~1~~ | ~~USDT/NGN~~ | Nigéria | — | — | — | — | ❌ **INDISPONÍVEL** — Binance suspendeu P2P NGN em Fev/2024, sem retoma (ver STATUS abaixo) |
| ~~2~~ | ~~USDT/BRL~~ | Brasil | — | — | — | — | ❌ **INDISPONÍVEL** — Binance sem anúncios activos neste par (confirmado 2026-08-14) |
| **3** | **BTC/IDR** | Indonésia | 1.5-4% | $20M+/dia | 120-240 min | $15-150 | 📈 Não implementado ainda — só USDT nos adaptadores actuais |
| **4** | **USDT/KES** | Quênia | 2-6% (números originais; **ver dados reais abaixo**) | $10M+/dia | 90-180 min | $20-150 | ✅ ACTIVO — Binance + Bybit P2P, dados reais a partir de 2026-08-14 |
| **5** | **USDT/PEN** | Peru | 1.5-3% (números originais; **ver dados reais abaixo**) | $8M+/dia | 60-120 min | $10-50 | ✅ ACTIVO — Binance + Bybit P2P, dados reais a partir de 2026-08-14 |

**STATUS REAL (2026-08-14, testado ao vivo — ver nota no topo do documento):**
Os pares activos da Fase 1 são **apenas USDT/KES e USDT/PEN** (`lib/p2p/intl/pairs-config.ts`,
`TARGET_PAIRS`). USDT/NGN e USDT/BRL estão em `INACTIVE_PAIRS` no mesmo ficheiro — o motor de
scan nunca lhes toca, para não gastar chamadas de API num par que só pode devolver "zero anúncios"
enquanto a Binance não tiver livro activo nesses dois. BTC/IDR nunca chegou a ser implementado
(os adaptadores actuais só pedem USDT). Os spreads de 2-6% e 1.5-3% nesta tabela são as
**estimativas originais do documento, não medições** — os números reais observados ao vivo em
2026-08-14 (10-18% bruto, com avisos sobre anúncios possivelmente não confiáveis) estão na nota de
correcção no topo do ficheiro; a Fase 1 existe precisamente para recolher uma semana de dados reais
antes de confiar em qualquer um dos dois conjuntos de números.

**Lógica de Ranking original (mantida para referência):**
- Spread > 3% = Viável com $10K+
- Spread > 2% = Marginal, requer volume
- Spread < 1% = Evitar completamente

---

## 3. ARQUITECTURA DO CICLO DE ARBITRAGEM

### Fluxo End-to-End (Exemplo USDT/NGN)

```
┌─────────────────────────────────────────────────────────────────────┐
│ ETAPA 1: IDENTIFICAÇÃO (5 min) — Monitoring                         │
├─────────────────────────────────────────────────────────────────────┤
│ Binance P2P (Seller Nigeria):     800 NGN/USDT                      │
│ LocalBitcoins (Buyer Nigeria):    850 NGN/USDT                      │
│ Spread Bruto:                     6.25% ✅ VIÁVEL                   │
│ Capital disponível:               $10,000 USD                        │
│ Recomendação:                     EXECUTE                            │
└─────────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────────┐
│ ETAPA 2: COMPRA (15-30 min) — Binance P2P                          │
├─────────────────────────────────────────────────────────────────────┤
│ Ação:                   Compra USDT @ 800 NGN/USDT                  │
│ Quantidade:             1,000 USDT                                  │
│ Método pagamento:       Bank transfer Nigeria                       │
│ Taxa Binance:           0% (P2P, sem platform fee)                  │
│ Taxa bancária:          -15 USD (1.5% típico)                       │
│ USDT recebido:          985 USDT                                    │
│ Custo:                  -15 USD / -1.5%                             │
└─────────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────────┐
│ ETAPA 3: TRANSFERÊNCIA (5-15 min) — Blockchain                     │
├─────────────────────────────────────────────────────────────────────┤
│ Rede:                   Polygon (USDT-e) ou Lightning                │
│ Tempo:                  5-15 minutos                                │
│ Taxa:                   -1 USD                                      │
│ USDT na carteira:       984 USDT                                    │
│ Custo:                  -1 USD / -0.1%                              │
└─────────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────────┐
│ ETAPA 4: VENDA (30-120 min) — LocalBitcoins P2P                    │
├─────────────────────────────────────────────────────────────────────┤
│ Ação:                   Venda USDT @ 850 NGN/USDT                   │
│ Quantidade:             984 USDT                                    │
│ Contrapartida:          Buyer nigeriano confiável                   │
│ Valor recebido:         983,400 NGN (984 × 850 - 1,600 NGN hold)    │
│ Taxa plataforma:        -29,502 NGN (3% LocalBitcoins)              │
│ Taxa bancária saída:    -9,834 NGN (1% transfer)                    │
│ NGN líquido:            944,064 NGN                                 │
│ Conversão para USD:     944,064 NGN ÷ 820 = ~1,151 USD             │
│ Custo:                  -4% global (plataforma + bancária)           │
└─────────────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────────┐
│ ETAPA 5: SETTLEMENT (0-2 dias) — Wise                              │
├─────────────────────────────────────────────────────────────────────┤
│ Ação:                   Converte NGN → USD via Wise                  │
│ Valor:                  944,064 NGN                                 │
│ Taxa Wise:              -14,161 NGN (1.5% típico)                   │
│ USD recebido:           ~1,128 USD                                  │
│ Custo:                  -1.5%                                       │
└─────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════
RESULTADO FINAL:

Entrada:       1,000 USD @ 800 NGN/USD = 800,000 NGN
Saída:         1,128 USD
Lucro:         128 USD
Spread capturado: 128/1000 = **12.8%** BRUTO
               128/1000 × (100-1.5-0.1-4-1.5)% = ~1.3% LÍQUIDO

CICLO COMPLETO: 90 minutos
ROI:           1.3% em 90 min = 20% ao dia (teórico)
═══════════════════════════════════════════════════════════════════════
```

### Análise de Custos Detalhada

```
RESUMO DE CUSTOS (por $1,000 USD entrada):

Compra:
├─ Taxa bancária (Binance → seu banco): -$15 (1.5%)
└─ Subtotal: -$15

Transferência Blockchain:
├─ Taxa rede (Polygon/Lightning): -$1 (0.1%)
└─ Subtotal: -$1

Venda P2P:
├─ Taxa plataforma (LocalBitcoins): -$29.40 (3%)
├─ Taxa bancária (saída): -$9.84 (1%)
└─ Subtotal: -$39.24

Settlement (Wise):
├─ Taxa conversão: -$16.92 (1.5%)
└─ Subtotal: -$16.92

TOTAL CUSTOS: -$73.16 / 1,000 USD = 7.3% de slippage

MAS SPREAD CAPTURADO: 6-8% (típico USDT/NGN)
LUCRO LÍQUIDO: 6-8% - 7.3% = -1.3% a +0.7%

❌ PROBLEMA: Custos acima do spread!
✅ SOLUÇÃO: 
  1. Usar capital $10K+ para diluir custos fixos
  2. Executar 3-5 ciclos em paralelo (múltiplos pares)
  3. Esperar spreads > 5% antes de executar
```

---

## 4. MODELO FINANCEIRO

### Break-Even & Capital Mínimo

```
Capital $1,000:
├─ Custos por ciclo: ~73 USD (7.3%)
├─ Spread mínimo viável: 8%+
├─ Frequência: 1-2 ciclos/semana
├─ Lucro/mês: $0-50
└─ ROI: -5% a +5% ❌ NÃO VIÁVEL

Capital $5,000:
├─ Custos por ciclo: ~365 USD (7.3%)
├─ Spread mínimo viável: 8%+
├─ Frequência: 2-5 ciclos/semana
├─ Lucro/mês: $100-500
└─ ROI: 2-10% ⚠️ MARGINAL

Capital $10,000:
├─ Custos por ciclo: ~730 USD (7.3%)
├─ Spread mínimo viável: 4%+
├─ Frequência: 5-10 ciclos/semana
├─ Lucro/mês: $1,500-3,000
└─ ROI: 15-30% ✅ VIÁVEL

Capital $50,000:
├─ Custos por ciclo: ~3,650 USD (7.3%)
├─ Spread mínimo viável: 2%+
├─ Frequência: 15-30 ciclos/semana
├─ Lucro/mês: $10,000-20,000
└─ ROI: 20-40% ✅✅ EXCELENTE
```

### Projeção de ROI (3 Meses)

#### Cenário: Capital Inicial $10,000 USD

```
MÊS 1: LEARNING & VALIDATION
├─ Ciclos executados: 5-10
├─ Spread médio: 3-4% (após custos = 0-1% líquido)
├─ Receita bruta: $10,000 × 3.5% × 7 ciclos = $2,450
├─ Custos operacionais: -$20 (monitoring, alertas)
├─ Lucro líquido: $2,430
├─ ROI: 24.3%
└─ Capital fim-mês: $12,430

MÊS 2: SCALING & OPTIMIZATION
├─ Ciclos executados: 15-20 (melhor timing, multi-pair)
├─ Spread médio: 4-5% (após custos = 1-2% líquido)
├─ Receita bruta: $12,430 × 4.5% × 18 ciclos = $10,068
├─ Custos: -$50 (APIs, VPS)
├─ Lucro líquido: $10,018
├─ ROI: 80.6%
└─ Capital fim-mês: $22,448

MÊS 3: AUTOMATION & SCALE
├─ Ciclos executados: 25-35 (full automation, 3+ pares)
├─ Spread médio: 3-5% (após custos = 1-2% líquido)
├─ Receita bruta: $22,448 × 4% × 30 ciclos = $26,938
├─ Custos: -$100 (infrastructure, labor)
├─ Lucro líquido: $26,838
├─ ROI: 119.4%
└─ Capital fim-mês: $49,286

═══════════════════════════════════════════════════════════════════════
ACUMULADO 3 MESES:
├─ Lucro total: $2,430 + $10,018 + $26,838 = $39,286
├─ Capital inicial: $10,000
├─ Capital final: $49,286
├─ ROI total: 392.86%
├─ ROI médio mensal: 57% (composto)
└─ Status: 🚀 ALTAMENTE VIÁVEL

ASSUMÇÕES:
├─ Cada ciclo leva ~90-120 minutos (4-5 ciclos/dia possível)
├─ Spreads >= 3% sempre disponíveis em 2+ pares
├─ Taxa de sucesso: 95%+ (mínimo chargeback/counterparty risk)
├─ Sem quedas de mercado (volatilidade < 1% durante ciclo)
└─ Hold period: 24-48h (segurança chargeback)
```

---

## 5. STACK TÉCNICO & INTEGRAÇÃO

### APIs Priorizadas (Por Ordem)

#### WAVE 1 (MVP Monitoring) — Semana 1-2

```typescript
// lib/p2p/binance-p2p-client.ts (EXISTENTE, REUSAR)
export class BinanceP2PClient {
  async getAds(
    fiat: string,
    crypto: 'USDT' = 'USDT',
    tradeType: 'BUY' | 'SELL' = 'BUY'
  ): Promise<Ad[]> {
    // Fetch da API pública Binance P2P
    // Exemplo: USDT/NGN sellers (quem vende USDT)
    return fetch(
      'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
      { 
        method: 'POST',
        body: JSON.stringify({
          fiat: fiat,
          crypto: crypto,
          tradeType: tradeType, // BUY = sellers, SELL = buyers
          page: 1,
          rows: 50,
          orderBy: 'price',
          transAmount: 1000
        })
      }
    ).then(r => r.json());
  }
}

// lib/p2p/local-bitcoins-client.ts (NOVO)
export class LocalBitcoinsClient {
  constructor(private apiKey: string) {}
  
  async getRates(countryCode: 'NGN' | 'BRL' | 'KES' = 'NGN') {
    // Fetch de LocalBitcoins API
    return fetch(
      `https://localbitcoins.com/api/ticker/?currency=${countryCode}`
    ).then(r => r.json());
  }
  
  async getAds(
    currency: string,
    tradeType: 'buy' | 'sell' = 'buy'
  ) {
    // Busca anúncios no mercado local
    return fetch(
      `https://localbitcoins.com/api/ticker/?currency=${currency}`
    ).then(r => r.json());
  }
}

// lib/p2p/spread-calculator.ts (NOVO)
export class SpreadCalculator {
  calculateOpportunity(
    binanceRate: number,
    localRate: number,
    costs: { buy: number; sell: number } = { buy: 0.015, sell: 0.03 }
  ) {
    const spreadBruto = (localRate - binanceRate) / binanceRate;
    const spreadLíquido = spreadBruto - costs.buy - costs.sell;
    
    return {
      spreadBruto: spreadBruto * 100,
      spreadLíquido: spreadLíquido * 100,
      isViable: spreadLíquido > 0.01, // 1% mínimo
    };
  }
}

// app/api/cron/arbitrage-scan/route.ts (NOVO)
export async function GET(req: Request) {
  const binance = new BinanceP2PClient();
  const local = new LocalBitcoinsClient();
  const calc = new SpreadCalculator();
  
  const pairs = [
    { symbol: 'USDT', fiat: 'NGN', name: 'Nigeria' },
    { symbol: 'USDT', fiat: 'BRL', name: 'Brasil' },
  ];
  
  const opportunities = [];
  
  for (const pair of pairs) {
    const binanceAds = await binance.getAds(pair.fiat, pair.symbol, 'BUY');
    const bestAsk = binanceAds[0]?.price; // Cheaper seller
    
    const localRates = await local.getRates(pair.fiat);
    const bestBid = localRates.avg?.24h; // Best buyer
    
    const opp = calc.calculateOpportunity(bestAsk, bestBid);
    
    if (opp.isViable) {
      opportunities.push({
        pair: `${pair.symbol}/${pair.fiat}`,
        region: pair.name,
        spreadPercent: opp.spreadLíquido,
        bestBid,
        bestAsk,
        profit: (10000 * opp.spreadLíquido / 100).toFixed(2) + ' USD',
      });
    }
  }
  
  // Persist to Supabase
  await db.insert(opportunities_table).values(opportunities);
  
  // Alert if spread > 3%
  if (opportunities.some(o => o.spreadPercent > 3)) {
    await notifyVia('telegram', 
      `🚀 OPORTUNIDADE: ${opportunities[0].pair} @ ${opportunities[0].spreadPercent.toFixed(2)}%`
    );
  }
  
  return Response.json({ opportunities });
}
```

#### WAVE 2 (Automação de Compra) — Semana 3-4

```typescript
// lib/p2p/binance-trader.ts (NOVO - requer KYC approval)
export class BinanceTrader {
  constructor(
    private apiKey: string,
    private apiSecret: string
  ) {}
  
  async createBuyOrder(
    usdtAmount: number,
    maxPrice: number, // Max NGN/USDT you'll pay
    merchantId?: string, // Opcional: prefer this seller
  ) {
    // Executa compra automática em Binance P2P
    // Requer:
    // 1. Account ter payment method verificado
    // 2. Estar verificado como trader P2P (KYC)
    // 3. Ter limite de volume (ex: $500-5000/dia)
    
    return fetch('https://p2p.binance.com/bapi/merchant/v2/merchant/createOrder', {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': this.apiKey,
      },
      body: JSON.stringify({
        tradeType: 'BUY',
        transAmount: usdtAmount,
        fiat: 'NGN',
        asset: 'USDT',
        publicAdvertiserId: merchantId,
        orderAmount: usdtAmount,
        price: maxPrice,
      }),
    }).then(r => r.json());
  }
}

// lib/p2p/arbitrage-engine.ts (NOVO - orquestrador)
export class ArbitrageEngine {
  private binance: BinanceTrader;
  private localBitcoins: LocalBitcoinsClient;
  private db: Database;
  
  async executeCycleStep1_Buy(opportunity: Opportunity) {
    // Step 1: Compra em Binance P2P
    const order = await this.binance.createBuyOrder(
      1000, // USDT
      opportunity.bestAsk,
    );
    
    // Persist order
    await this.db.insert('orders').values({
      id: order.orderId,
      status: 'pending',
      type: 'buy',
      pair: opportunity.pair,
      amount: 1000,
      price: opportunity.bestAsk,
      createdAt: new Date(),
    });
    
    return order;
  }
  
  async waitForBuyConfirmation(orderId: string) {
    // Poll até confirmação (user manually confirms em Binance app)
    // Ou webhook se Binance suportar
    
    let attempt = 0;
    while (attempt < 60) { // Max 10 minutes
      const order = await this.binance.getOrderStatus(orderId);
      
      if (order.status === 'COMPLETED') {
        return order;
      }
      
      await new Promise(r => setTimeout(r, 10000)); // 10 sec poll
      attempt++;
    }
    
    throw new Error(`Order ${orderId} não foi completado em 10 min`);
  }
}
```

#### WAVE 3 (Automação de Venda) — Semana 5-6

```typescript
// lib/p2p/local-bitcoins-trader.ts (NOVO)
export class LocalBitcoinsTrader {
  constructor(private apiKey: string, private apiSecret: string) {}
  
  async createSellOrder(
    usdtAmount: number,
    minPrice: number, // Min NGN/USDT you'll accept
  ) {
    // Criar anúncio de venda em LocalBitcoins
    return fetch(
      'https://localbitcoins.com/api/ad-create/',
      {
        method: 'POST',
        body: new URLSearchParams({
          location_string: 'Nigeria',
          currency: 'NGN',
          trade_type: 'SELL',
          price_equation: `x * ${minPrice / 100}`,
          account_details: JSON.stringify({
            methods: ['BANK_TRANSFER', 'MOBILE_MONEY'],
          }),
        }),
      }
    ).then(r => r.json());
  }
  
  async getIncomingOrders() {
    // Monitora orders de buyers
    return fetch(
      'https://localbitcoins.com/api/dashboard/',
      { headers: { 'Authorization': `Bearer ${this.apiKey}` } }
    ).then(r => r.json()).then(r => r.buy_orders);
  }
  
  async confirmSaleAndRelease(orderId: string) {
    // Confirma venda e libera USDT do escrow
    return fetch(
      `https://localbitcoins.com/api/order-confirm-release/${orderId}/`,
      { method: 'POST' }
    ).then(r => r.json());
  }
}

// lib/p2p/settlement-client.ts (NOVO)
export class SettlementClient {
  // Wise.com API para converter NGN/BRL → USD
  async transferToUSD(
    amount: number,
    sourceCurrency: 'NGN' | 'BRL' | 'KES',
    bankDetails: { name: string; account: string; bank: string }
  ) {
    // Criar transfer Wise
    return fetch('https://api.wise.com/v1/transfers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WISE_API_KEY}`,
      },
      body: JSON.stringify({
        targetAccount: bankDetails,
        quote: {
          sourceCurrency,
          targetCurrency: 'USD',
          sourceAmount: amount,
        },
      }),
    }).then(r => r.json());
  }
}
```

### Fluxo Automático Completo

```typescript
// lib/p2p/full-cycle.ts (NOVO)
export class FullArbitrageCycle {
  async executeFullCycle(opportunity: Opportunity) {
    console.log(`[${new Date()}] Starting cycle for ${opportunity.pair}`);
    
    // STEP 1: Buy
    const buyOrder = await this.binance.createBuyOrder(
      1000,
      opportunity.bestAsk,
    );
    console.log(`[BUY] Order ${buyOrder.orderId} created`);
    
    // Wait for buy confirmation
    let buyConfirmed = false;
    while (!buyConfirmed) {
      const status = await this.binance.getOrderStatus(buyOrder.orderId);
      if (status.status === 'COMPLETED') {
        buyConfirmed = true;
      } else {
        await sleep(10_000);
      }
    }
    console.log(`[BUY] Confirmed at ${buyOrder.actualPrice}`);
    
    // STEP 2: Transfer
    const txHash = await this.transferViaLightning(
      '0x...' // buyer wallet
    );
    console.log(`[TRANSFER] Hash: ${txHash}`);
    
    // Wait for blockchain confirmation
    await this.waitForBlockchainConfirmation(txHash);
    console.log(`[TRANSFER] Confirmed on blockchain`);
    
    // STEP 3: Sell
    const sellOrder = await this.localBitcoins.createSellOrder(
      1000,
      opportunity.bestBid * 0.99, // 1% buffer for slippage
    );
    console.log(`[SELL] Ad ${sellOrder.adId} created`);
    
    // Wait for buyer
    let buyerFound = false;
    let incomingOrder;
    while (!buyerFound) {
      const orders = await this.localBitcoins.getIncomingOrders();
      incomingOrder = orders.find(o => o.ad_id === sellOrder.adId);
      if (incomingOrder?.status === 'paid') {
        buyerFound = true;
      } else {
        await sleep(30_000); // 30 sec poll
      }
    }
    console.log(`[SELL] Buyer found: ${incomingOrder.buyer}`);
    
    // Confirm sale and release USDT
    await this.localBitcoins.confirmSaleAndRelease(incomingOrder.id);
    console.log(`[SELL] Confirmed, USDT released`);
    
    // STEP 4: Settlement
    const settlement = await this.settlement.transferToUSD(
      incomingOrder.amount_in_fiat,
      'NGN',
      {
        name: 'Your Bank',
        account: '...',
        bank: 'Access Bank',
      }
    );
    console.log(`[SETTLEMENT] Transfer ${settlement.id} created`);
    
    // Log cycle to DB
    await this.db.insert('cycles').values({
      pair: opportunity.pair,
      buyPrice: buyOrder.actualPrice,
      sellPrice: incomingOrder.price,
      spreadPercent: ((incomingOrder.price - buyOrder.actualPrice) / buyOrder.actualPrice * 100),
      profitUSD: settlement.targetAmount - 1000,
      status: 'completed',
      createdAt: new Date(),
    });
    
    return {
      success: true,
      profitUSD: settlement.targetAmount - 1000,
    };
  }
}
```

---

## 6. ROADMAP DE IMPLEMENTAÇÃO

### Fase 1: MVP Monitoring (Semana 1-2)

**Goal:** Dashboard mostrando spreads em tempo real para top 5 pares.

**Tasks:**
- [ ] Deploy `/api/cron/arbitrage-scan` que fetcha Binance P2P + LocalBitcoins
- [ ] Criar `ArbitrageOpportunity` table em Supabase
- [ ] Build dashboard com:
  - Spread % por par
  - Best bid/ask prices
  - Profit projection para $10K capital
  - Time-based alerts
- [ ] Test com dados reais 1 semana

**Deliverables:**
- Dashboard funcional mostrando spreads
- 3-5 pares monitorados 24/7
- Email/SMS alerts quando spread > 3%

**Success Criteria:**
- Identificar >= 5 oportunidades/dia com spread >= 3%
- Zero false positives (spreads confirmadas com delay < 5 min)

---

### Fase 2: Execução Manual (Semana 3-4)

**Goal:** Executar 10-20 ciclos com capital real ($5,000 USD) e validar PnL.

**Tasks:**
- [ ] Setup Binance P2P account (KYC completo, payment methods verificados)
- [ ] Setup LocalBitcoins account + merchant status
- [ ] Setup Wise account para settlement
- [ ] Criar `Cycle` table com fields: buy_price, sell_price, fees, profit
- [ ] Manual execution workflow:
  - 1. Monitor alerts
  - 2. Executa compra em Binance P2P
  - 3. Transfere USDT via Polygon/Lightning
  - 4. Cria anúncio em LocalBitcoins
  - 5. Aguarda buyer
  - 6. Confirma venda
  - 7. Settlement via Wise
  - 8. Logs resultado no DB
- [ ] Análise de custos reais vs projeções

**Deliverables:**
- 10-20 ciclos completados com capital real
- PnL log no Supabase
- Documento com custos reais validados

**Success Criteria:**
- >= 90% dos ciclos rentáveis (>= 0.5% spread líquido)
- Custos reais dentro de ±10% das projeções
- Zero chargebacks/disputes

---

### Fase 3: Semi-Automático (Semana 5-6)

**Goal:** Automação de compra + alertas de venda. Escalas para $10K capital.

**Tasks:**
- [ ] Implementar `BinanceTrader` class com Buy order automation
- [ ] Integrar Binance P2P API (requer approval)
- [ ] Create webhook para confirmação de compra (poll ou Telegram notify)
- [ ] Criar `ArbitrageEngine` class com ciclo parcialmente automático
- [ ] Build UI para:
  - Executar compra com um click
  - Listar incoming orders de LocalBitcoins
  - Confirmar venda com um click
- [ ] Auto-transfer USDT via Polygon após confirmação
- [ ] Escalas para 20-30 ciclos/mês

**Deliverables:**
- Semi-automático buy workflow
- Alert na venda (manual confirm)
- 20-30 ciclos/mês com $10K capital
- Lucro esperado: $1,500-3,000

**Success Criteria:**
- >= 95% ciclos com 30-90 min de total time
- Automação de compra economiza >= 5 min por ciclo
- ROI >= 15% no mês

---

### Fase 4: Full-Automático (Semana 7-8)

**Goal:** Pipeline end-to-end automático. 50-100 ciclos/mês.

**Tasks:**
- [ ] Integrar `LocalBitcoinsTrader` com sell order automation
- [ ] Integrar `SettlementClient` para Wise transfers automáticas
- [ ] Criar guardrails:
  - Max $5K por ciclo (risk limit)
  - Min 24h hold antes de settlement (chargeback protection)
  - Reputação do buyer >= 4/5 stars
  - Only execute se spread >= 2% (risk-adjusted)
- [ ] Monitoring dashboard:
  - Live cycle status
  - PnL chart (daily, weekly, monthly)
  - Risk alerts (delayed settlements, low spreads)
- [ ] Error handling + retry logic
  - Failed transfers → fallback manual intervention
  - Missed buyers → auto-close ad, relist
- [ ] Scaling para 3-5 pares simultâneos

**Deliverables:**
- Fully automated end-to-end workflow
- 50-100 ciclos/mês automáticos
- PnL dashboard com histórico
- Risk management layer

**Success Criteria:**
- >= 95% ciclos completely automated
- Avg cycle time: 60-90 min from buy to settlement
- Monthly ROI >= 30%
- Zero manual intervention needed (except emergencies)

---

## 7. RISCOS & MITIGAÇÕES

| Risco | Probabilidade | Impacto | Mitigação |
|-------|-------------|--------|-----------|
| **Chargeback** (buyer reverses payment) | Média (2-5%) | Alto (-$1K) | Hold 45+ dias, high-rate merchants only, insurance fund |
| **Liquidity** (no buyers at given price) | Média (5-10%) | Médio (-2h delay) | Multi-pair arbitrage, dynamic pricing, broadcast to multiple platforms |
| **Volatilidade** (preço cai durante ciclo) | Média (3-7%) | Médio (-0.5%) | Fix price forward contract, 90min max cycle time |
| **Regulação** (restrições P2P) | Média (1-3% impacto) | Médio (volume cap) | Múltiplos accounts, jurisdictions, compliance monitoring |
| **Counterparty** (plataforma bugs/maintenance) | Baixa (< 1%) | Alto (capital locked) | Múltiplas plataformas, fallback procedures |
| **Taxa Wise/bancária** (slippage) | Alta (100%) | Baixo (+/- 0.5%) | Negotiate bulk rates, use Kraken alternative |
| **Regulatory KYC** (account frozen) | Baixa (< 1%) | Alto (capital frozen) | Monitora policy changes, pre-plan exit strategy |

---

## 8. MÉTRICAS DE SUCESSO

### Tracking (via Supabase + Dashboard)

```
Daily:
├─ Spreads identificadas (count by pair)
├─ Ciclos executados (count)
├─ Lucro bruto vs líquido
├─ Tempo médio de ciclo
└─ Taxa de sucesso (% completados)

Weekly:
├─ Total volume traded (USD)
├─ Total profit (USD & %)
├─ PnL por par
├─ Chargeback/dispute rate
└─ Largest profit cycle

Monthly:
├─ ROI (vs capital inicial)
├─ Annualized ROI projection
├─ Capital growth
├─ Custos operacionais
└─ Break-even analysis
```

### Green/Yellow/Red Thresholds

```
GREEN:
├─ Spread identified >= 3%/day: 5+ oportunidades
├─ Ciclos ejecutados: >= 20/mês
├─ Taxa sucesso: >= 95%
├─ ROI: >= 20%/mês
└─ Chargeback rate: < 2%

YELLOW:
├─ Spread identified < 3%/day: 2-5 oportunidades
├─ Ciclos ejecutados: 10-20/mês
├─ Taxa sucesso: 85-95%
├─ ROI: 10-20%/mês
└─ Chargeback rate: 2-5%

RED:
├─ Spread identified < 1%/day: 0-1 oportunidade
├─ Ciclos ejecutados: < 10/mês
├─ Taxa sucesso: < 85%
├─ ROI: < 10%/mês
└─ Chargeback rate: > 5%
```

---

## 9. QUESTIONS & DECISION POINTS

**Before Fase 1:**
- [ ] Confirmar capital inicial $5K-10K USD disponível?
- [ ] Confirmar KYC em Binance P2P, LocalBitcoins, Wise?
- [ ] Qual é a jurisdição do seu "home base"? (impacta KYC/regulação)

**Before Fase 2:**
- [ ] Testar com mínimo $500 em ciclos primeiro?
- [ ] Confirmar que spreads >= 3% ocorrem diariamente?

**Before Fase 3:**
- [ ] Custos reais estão dentro de projeções?
- [ ] Está satisfeito com 1-2% lucro líquido por ciclo?

**Before Fase 4:**
- [ ] Testar LocalBitcoins API integração com $1K volume?
- [ ] Implementar fail-safe para chargebacks/frozen funds?

---

## 10. REFERENCIAS & RECURSOS

### APIs & Plataformas
- [Binance P2P API Docs](https://developers.binance.com/docs/wallet/pay_api)
- [LocalBitcoins API](https://localbitcoins.com/api-docs/)
- [Wise API](https://docs.wise.com/)
- [Kraken API](https://docs.kraken.com/rest/)

### Libraries
- `@binance/connector` (official Binance SDK)
- `node-localbitcoins` (community wrapper)
- `wise-sdk` (official Wise)

### Monitoring & Alerting
- Telegram Bot API (alerts)
- Supabase Webhooks (real-time updates)
- Datadog / Sentry (error tracking)

---

## STATUS & PRÓXIMOS PASSOS

**Status:** READY FOR PHASE 1  
**Última Atualização:** 2026-08-14  
**Owner:** [Seu nome]

### Próximos Passos Imediatos:
1. **Hoje:** Revisar esta estratégia, confirmar capital
2. **Amanhã:** Setup contas (Binance P2P KYC, LocalBitcoins, Wise)
3. **Dia 3:** Deploy MVP Monitoring dashboard
4. **Dia 7:** Analisar spreads reais, validar oportunidades
5. **Dia 14:** Decidir sobre Fase 2 (início automação)

---

**Comments/Questions?** → DM ou Telegram  
**Want to collaborate?** → Fork `.planning/` e submete PRs  

---
