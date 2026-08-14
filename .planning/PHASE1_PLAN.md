# 📋 PHASE 1 PLAN — Market Validation (Semana 1-2)

**Status:** READY TO EXECUTE  
**Start Date:** 2026-08-14 (TODAY)  
**Capital:** $30,000 USD  
**Jurisdiction:** Moçambique  
**Expected Duration:** 7-10 days  
**Owner:** Dev + User  

---

> ⚠️ **CORREÇÃO (2026-08-14):** "LocalBitcoins" abaixo (Task 1.1 conta do
> user, subtask 1.1.2 API do dev) refere-se a uma plataforma que encerrou o
> P2P em 2023. Substituto: Bybit P2P / OKX P2P / MEXC P2P — confirmação do
> endpoint exacto em curso, ver [STRATEGY.md](../STRATEGY.md). Contas do
> user já confirmadas (mensagem 2026-08-14) — dev pode avançar; a conta
> LocalBitcoins da checklist original fica sem efeito, não bloqueia.
>
> Também: `lib/p2p/scan.ts` + `db/schema.ts` já implementam um motor de
> scan/alerta/optimizer maduro para USDT/MZN — a Task 1.1-1.3 abaixo
> (escrever `BinanceP2PClient`, `SpreadCalculator`, tabela `opportunities`
> do zero) é redundante nesses pontos. Reusar `binance-client.ts` (já
> genérico por fiat) e criar tabelas NOVAS e independentes para o scan
> internacional (não tocar no schema MZN, que está em produção).
>
> **Actualização 2026-08-14:** Implementado e em produção — tabela
> `intl_opportunities` migrada, scan bidireccional Binance↔Bybit, painel
> `/arbitragem-intl`, cron externo já configurado pelo utilizador. Pares
> activos por agora: **USDT/KES e USDT/PEN** — NGN e BRL ficaram fora
> porque a Binance não tem anúncios activos em nenhum dos dois (ver
> STRATEGY.md).
>
> **Actualização 2026-08-15:** a pedido do utilizador, deixámos de tratar
> isto como "espera uma semana antes de veres nada" — o painel
> `/arbitragem-intl` mostra directamente "comprar em X, vender em Y, lucro
> estimado" para quem quiser olhar hoje, não uma tabela de validação.
> Alargado de 2 para 10 pares (todos testados ao vivo nos dois lados antes
> de entrarem). O código só foi publicado (commit + push + deploy) nesta
> data — antes disso o cron do utilizador estava a apontar para uma versão
> da app sem nada disto, daí não aparecer nada.

---

## 🎯 OBJECTIVE

Deploy real-time monitoring dashboard for 6 P2P platforms (Binance P2P, LocalBitcoins, Paxful, Kraken, Wise, DEX). Collect 7 days of spread data to validate that spreads >= 3% occur regularly in top 5 pairs.

**Success Criteria:**
- ✅ Dashboard live & monitorando 24/7
- ✅ >= 5 oportunidades/dia com spread >= 3% identificadas
- ✅ < 5% false positives (spreads não confirmadas)
- ✅ Spread average realista em cada par
- ✅ Decision: GO para PHASE 2 ou PIVOT

---

## 📅 TIMELINE

```
DAY 1 (14 Aug - TODAY):
├─ Confirm contas + wallets
├─ Pre-apply Binance P2P merchant
├─ Dev começa API integrations
└─ Deadline: 6pm

DAY 2-3 (15-16 Aug):
├─ Dev: Deploy /api/cron/arbitrage-scan
├─ Dev: Create DB schema
├─ Dev: Build dashboard UI
├─ You: Confirm KYC approvals
└─ Target: Dashboard LIVE by 3pm Day 3

DAY 4-7 (17-21 Aug):
├─ Monitor dashboard 24/7
├─ Collect spread data
├─ Analyze patterns
├─ Make GO/NO-GO decision
└─ Deadline: Fri 6pm
```

---

## 👤 TASKS FOR YOU (TODAY - 14 AUG)

### Task 1.1: Confirm Existing Accounts

**What to do:**
- [ ] **Binance P2P Account:**
  - Do you have account? (SIM/NAO)
  - KYC completed? (SIM/NAO)
  - Have merchant approval already? (SIM/NAO/PENDENTE)
  - If PENDENTE: Send me screenshot of application status

- [ ] **LocalBitcoins Account:**
  - Username: ___________
  - Merchant status? (SIM/NAO/PENDENTE)
  - Preferred fiat currency: MZN

- [ ] **Wise Account:**
  - Type: ☐ Personal ☐ Business
  - Verified? (SIM/NAO)
  - Main currency: USD

- [ ] **Crypto Wallets:**
  - ☐ Binance Wallet (Exchange wallet)
  - ☐ MetaMask (self-custody)
  - ☐ Trust Wallet (mobile self-custody)
  - ☐ Ledger/Hardware wallet
  - Preferred: ___________

**Deadline:** TODAY 6pm  
**Time:** ~15 min

---

### Task 1.2: Pre-Apply for Binance P2P Merchant (IF NOT APPROVED YET)

**What to do:**
1. Go to: https://www.binance.com/en/c2c/merchant
2. Click "Apply for Merchant"
3. Fill form:
   - Country: Mozambique
   - Payment methods: Bank Transfer (Mozambique banks)
   - Trading pair: USDT (primary), BTC (secondary)
   - Trading type: Both BUY & SELL
   - Monthly trading volume: $30,000+
   - Profile: "P2P Arbitrage Trader"

4. Submit application
5. Send me: Screenshot of confirmation

**Deadline:** TODAY 9pm  
**Timeline:** Binance typically approves in 1-3 weeks  
**Note:** Process can continue in parallel with PHASE 1 monitoring

**Time:** ~20 min

---

### Task 1.3: Prepare Crypto Wallets

**What to do:**
1. Create/confirm USDT wallet address for transfers:
   - On which network? (Polygon = cheap, Lightning = fast, Ethereum = standard)
   - Preferred: **Polygon** (fees: $0.50-1)

2. Share with Dev:
   - Wallet address for USDT receives
   - Network preference (Polygon/Lightning/Ethereum)

3. Test small transfer (~$1 USDT):
   - Send $1 from Binance → your wallet
   - Confirm receipt
   - Estimated time: 5-15 min

**Deadline:** TODAY 7pm  
**Time:** ~20 min

---

## 👨‍💻 TASKS FOR DEV (TODAY → DAY 3)

### Task 1.1: API Integrations (DAY 1-2)

**Subtask 1.1.1: Binance P2P API**
```typescript
// lib/p2p/binance-p2p-client.ts
export class BinanceP2PClient {
  async getAds(
    fiat: 'MZN' | 'BRL' | 'NGN' | 'KES' | 'PEN',
    crypto: 'USDT' | 'BTC',
    tradeType: 'BUY' | 'SELL'
  ): Promise<Ad[]>
  
  async getOrderbook(pair: string): Promise<Orderbook>
}
```
- Endpoint: `https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search`
- Fetch every 5 min for 5 pairs
- Store in Supabase `opportunities` table
- **Effort:** 4h

**Subtask 1.1.2: LocalBitcoins API**
```typescript
export class LocalBitcoinsClient {
  async getRates(currency: string): Promise<Rate[]>
  async getAds(currency: string, tradeType: 'buy'|'sell'): Promise<Ad[]>
}
```
- Endpoint: `https://localbitcoins.com/api/ticker/?currency=MZN`
- Fetch every 10 min
- **Effort:** 2h

**Subtask 1.1.3: Kraken API (Backup Pricing)**
```typescript
export class KrakenClient {
  async getPrice(pair: string): Promise<Price>
}
```
- Use for USD/fiat reference rates
- **Effort:** 1h

**Subtask 1.1.4: Spread Calculator**
```typescript
export class SpreadCalculator {
  calculateOpportunity(
    platform1: Rate,
    platform2: Rate,
    costs: CostModel
  ): Opportunity
}
```
- Calculate net spread after fees
- Mark as "VIABLE" if spread > 3%
- **Effort:** 2h

**Total Subtask Effort:** 9h | **Deadline:** End Day 2

---

### Task 1.2: Database Schema (DAY 1)

**Create tables:**

```sql
-- opportunities
CREATE TABLE opportunities (
  id SERIAL PRIMARY KEY,
  pair VARCHAR(20),           -- USDT/MZN, BTC/BRL, etc
  region VARCHAR(50),         -- Mozambique, Brazil, Nigeria
  best_bid DECIMAL(12,2),    -- Best buyer price
  best_ask DECIMAL(12,2),    -- Best seller price
  spread_percent DECIMAL(5,2),
  profit_at_30k DECIMAL(10,2),
  source_buy VARCHAR(50),    -- Binance P2P, LocalBitcoins
  source_sell VARCHAR(50),
  viability VARCHAR(20),     -- VIABLE, MARGINAL, SKIP
  created_at TIMESTAMP DEFAULT NOW(),
  collected_at TIMESTAMP
);

-- cycles (for PHASE 2)
CREATE TABLE cycles (
  id SERIAL PRIMARY KEY,
  pair VARCHAR(20),
  status VARCHAR(20),        -- pending, executing, completed, failed
  buy_price DECIMAL(12,2),
  sell_price DECIMAL(12,2),
  spread_percent DECIMAL(5,2),
  profit_usd DECIMAL(10,2),
  fees_total DECIMAL(10,2),
  duration_minutes INT,
  created_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- market_data (historical)
CREATE TABLE market_data (
  id SERIAL PRIMARY KEY,
  pair VARCHAR(20),
  platform VARCHAR(50),
  price DECIMAL(12,2),
  volume DECIMAL(10,2),
  recorded_at TIMESTAMP
);
```

**Effort:** 2h | **Deadline:** End Day 1

---

### Task 1.3: Dashboard UI (DAY 2-3)

**Create page:** `app/(app)/arbitrage-monitor/`

**Features:**
1. **Live Spreads Table**
   - Columns: Pair | Platform | Bid | Ask | Spread% | Profit@30K | Status
   - Sort by: Spread (highest first)
   - Filter by: Min Spread, Pair, Region
   - Auto-refresh: Every 30s
   - **Effort:** 4h

2. **Spread Over Time Chart**
   - X-axis: Time (last 24h)
   - Y-axis: Spread %
   - Lines per pair (USDT/MZN, USDT/BRL, BTC/IDR, etc)
   - Highlights: When spread > 3% (green), < 1% (red)
   - **Effort:** 3h

3. **Opportunity Alerts History**
   - List of all alerts sent
   - Timestamp, pair, spread%, action taken
   - **Effort:** 2h

4. **Statistics Card**
   - Opportunities today (count)
   - Best spread captured today
   - Average spread today
   - Viability % (how many > 3%)
   - **Effort:** 2h

5. **Mobile Responsive**
   - Works on phone
   - Stack to single column
   - Simplified charts
   - **Effort:** 2h

**Total UI Effort:** 13h | **Deadline:** End Day 3

---

### Task 1.4: Deploy Cron Job (DAY 2)

**Create:** `/api/cron/arbitrage-monitor`

```typescript
export async function GET(req: Request) {
  // Authenticate with CRON_SECRET
  const binance = new BinanceP2PClient();
  const localBitcoins = new LocalBitcoinsClient();
  const calc = new SpreadCalculator();
  
  // Fetch prices from all platforms
  const pairs = ['USDT/MZN', 'USDT/BRL', 'BTC/IDR', 'USDT/KES', 'USDT/PEN'];
  
  for (const pair of pairs) {
    const binanceRates = await binance.getAds(pair);
    const localRates = await localBitcoins.getRates(pair);
    
    const opportunity = calc.calculateOpportunity(
      binanceRates,
      localRates
    );
    
    if (opportunity.viability === 'VIABLE') {
      // Store in DB
      await db.insert(opportunities).values(opportunity);
      
      // Send alert
      if (opportunity.spread_percent > 4) {
        await notifyVia('telegram', 
          `🚀 ${pair}: ${opportunity.spread_percent.toFixed(1)}%`
        );
      }
    }
  }
  
  return Response.json({ status: 'ok' });
}
```

**Schedule:** Every 5 minutes via Vercel Cron or external service

**Effort:** 3h | **Deadline:** End Day 2

---

## 📊 SUCCESS METRICS

**After 7 days of monitoring:**

```
✅ LEVEL 1 (Baseline):
├─ Dashboard is live and collecting data
├─ At least 1 viable opportunity per day (spread >= 3%)
└─ Zero critical errors in data collection

✅ LEVEL 2 (Good):
├─ 3-5 viable opportunities per day
├─ Average spread identified: 3-5%
├─ < 10% false positives
├─ Consistent data collection 24/7
└─ Clear patterns by pair/region

✅ LEVEL 3 (Excellent):
├─ 5-10 viable opportunities per day
├─ Average spread identified: 4-6%
├─ < 5% false positives
├─ Best spreads: > 6% regularly
├─ Clear winning pairs identified
└─ Decision: STRONG GO for PHASE 2
```

---

## 🚨 RISKS & CONTINGENCIES

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Binance P2P API blocked | Low | Use web scraping fallback |
| LocalBitcoins API rate limit | Low | Implement backoff + retry |
| Spreads < 2% consistently | Low | Pivot to additional pairs |
| Dashboard crashes | Medium | Implement error handling, auto-restart |
| Network outages | Low | Implement retry logic, caching |

---

## 📋 GO/NO-GO DECISION CRITERIA (DAY 7)

**GO for PHASE 2 if:**
- ✅ >= 3 viable opportunities per day (spread >= 3%)
- ✅ >= 2 pairs consistently viable (e.g., USDT/MZN + USDT/BRL)
- ✅ Average spread > 3%
- ✅ Dashboard 99% uptime

**NO-GO / PIVOT if:**
- ❌ < 1 opportunity per day
- ❌ Only 1 pair viable (high concentration risk)
- ❌ Average spread < 2%
- ❌ Dashboard unreliable

---

## 📋 NEXT PHASE (PHASE 2)

If GO: **Manual execution with capital real ($5K-10K initial)**
- Deploy PHASE 2 on 2026-08-21
- Execute 10-20 cycles manually
- Validate PnL end-to-end

---

**Prepared by:** AI Assistant  
**Status:** READY TO BEGIN  
**Next Review:** 2026-08-21 (End of PHASE 1)

