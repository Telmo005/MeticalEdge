# 📋 ROADMAP — Arbitragem P2P Internacional

**Status:** DRAFT — Aguardando aprovação para iniciar PHASE 1  
**Created:** 2026-08-14  
**Updated:** [quando confirmado]

---

> ⚠️ **CORREÇÃO (2026-08-14):** "LocalBitcoins" nas tasks abaixo (setup de
> conta, API integration, sell automation) refere-se a uma plataforma que
> encerrou o P2P em 2023 (Paxful também, em Nov/2025). Substituir por uma
> plataforma viva com liquidez real na região — ver nota em [STRATEGY.md](../STRATEGY.md).
> Além disso: `lib/p2p/binance-client.ts` já existe e já é genérico por
> `fiat` — não recriar do zero como as tasks abaixo sugerem, reusar.
>
> **Actualização 2026-08-14:** Fase 1 implementada e a correr (Bybit P2P
> ligado, cron externo configurado pelo utilizador). Pares activos:
> **USDT/KES e USDT/PEN** apenas — USDT/NGN e USDT/BRL retirados da
> varredura porque a Binance não tem livro activo em nenhum dos dois
> (testado ao vivo, ver STRATEGY.md). BTC/IDR nunca foi implementado.

---

## PHASE 1: Market Validation (Semana 1-2)

### Objetivo
Validar que spreads >= 3% ocorrem regularmente em top 5 pares (USDT/NGN, USDT/BRL, BTC/IDR, USDT/KES, USDT/PEN) e que identificação automática é viável.

### Tasks

#### Task 1.1: Deploy `/api/cron/arbitrage-scan`
- [ ] Create `lib/p2p/arbitrage-scan.ts` (reusar `BinanceP2PClient` existente)
- [ ] Integrar `LocalBitcoinsClient` nova (fetch rates public API)
- [ ] Implementar `SpreadCalculator.calculateOpportunity()`
- [ ] Deploy endpoint `/api/cron/arbitrage-scan` que:
  - Fetcha Binance P2P (5 pares × 2 tradeTypes = 10 calls)
  - Fetcha LocalBitcoins (5 pares × rates)
  - Calcula spreads líquidos
  - Persiste em Supabase `opportunities` table
- [ ] Schedule em cron cada 5 minutos
- **Effort:** 8h | **Owner:** Dev

#### Task 1.2: Create DB Schema
- [ ] Add `opportunities` table:
  ```sql
  id, pair, region, best_bid, best_ask, spread_percent, 
  profit_at_10k, created_at, source_binance, source_local
  ```
- [ ] Add `cycles` table (para tracking Phase 2):
  ```sql
  id, pair, status, buy_price, sell_price, spread_percent,
  profit_usd, fees_total, duration_min, created_at, completed_at
  ```
- [ ] Migrations via Drizzle
- **Effort:** 3h | **Owner:** Dev

#### Task 1.3: Build Dashboard
- [ ] Create page `app/(app)/arbitrage/` com:
  - Table de oportunidades (pair, bid, ask, spread%, profit@$10K)
  - Charts: Spread over time (line chart, 24h window)
  - Filters: Min spread%, pair selector, region
  - Real-time updates (via WebSocket ou polling 30s)
  - Alert history (which opportunities were identified)
- [ ] Mobile-responsive design
- **Effort:** 12h | **Owner:** Dev + UI

#### Task 1.4: Testing & Validation
- [ ] Monitor dashboard por 7 dias
- [ ] Coletainúmeros:
  - How many opportunities per day >= 3%?
  - Distribution by pair/region?
  - False positive rate (spreads não confirmadas)?
  - Average spread (what can realistically be captured)?
- [ ] Documenta findings em `PHASE1_RESULTS.md`
- **Effort:** 5h (passive monitoring)

#### Task 1.5: Decision & Gate Review
- [ ] Reunião: Revisar resultados PHASE 1
- [ ] Confirmar:
  - [ ] >= 5 oportunidades/dia com spread >= 3% em 2+ pares?
  - [ ] < 5% false positives?
  - [ ] Spread average realista?
- [ ] **GO/NO-GO decision para PHASE 2**
- **Effort:** 2h | **Owner:** Dev + User

---

**PHASE 1 TOTAL EFFORT:** ~30h (2 semanas, part-time)  
**Deliverables:**
- Live monitoring dashboard
- 1 semana de dados históricos
- Decision document (GO/NO-GO)

---

## PHASE 2: Manual Execution (Semana 3-4)

### Objetivo
Executar 10-20 ciclos de arbitragem manualmente com capital real ($5K USD) para validar PnL end-to-end e identificar pain points.

### Tasks

#### Task 2.1: Setup Contas (KYC & Verificações)
- [ ] **Binance P2P:**
  - [ ] Complete KYC (ID + face recognition)
  - [ ] Add payment method (bank account local)
  - [ ] Verificar merchant approval
  - [ ] Testar buy order mock
- [ ] **LocalBitcoins:**
  - [ ] Criar account
  - [ ] KYC básico
  - [ ] Apply para merchant status
  - [ ] Completar setup de métodos de pagamento
- [ ] **Wise:**
  - [ ] Criar business account
  - [ ] Verificar identity
  - [ ] Link bank account
  - [ ] Testar transfer mock
- **Effort:** 6h | **Owner:** User (com Tech Support)

#### Task 2.2: Manual Cycle Workflow
- [ ] Documentar SOP (Standard Operating Procedure):
  1. Monitor dashboard, identifica oportunidade spread >= 3%
  2. Manualment purchase USDT em Binance P2P
  3. Transferir USDT via Polygon/Lightning (record hash)
  4. Create sell ad em LocalBitcoins
  5. Aguardar buyer
  6. Confirmar venda + release USDT
  7. Settlement via Wise (NGN → USD)
  8. Log resultado no DB
- [ ] Criar checklist em app para cada step
- [ ] Instruções com screenshots
- **Effort:** 4h | **Owner:** Dev + User

#### Task 2.3: Cycle Logging & Analytics
- [ ] Build quick-entry form para log cada ciclo:
  - Buy price, sell price, fees incurred
  - Time taken (buy → settlement)
  - Spread capturado (%), profit (USD)
  - Notes (any issues?)
- [ ] Auto-calculate metrics:
  - Lucro líquido por ciclo
  - ROI por ciclo
  - Cumulative profit
- [ ] Dashboard mostrando:
  - Historical cycles (list with details)
  - PnL por day/week
  - Average metrics (spread, time, profit)
- **Effort:** 6h | **Owner:** Dev

#### Task 2.4: Execute Cycles
- [ ] Ejecutar 10-20 ciclos manualmente (over 2 weeks)
- [ ] Target: 1-2 ciclos/dia (depends on opportunities)
- [ ] Log cada ciclo com:
  - Timestamps (buy start, buy end, transfer, sell start, sell end)
  - Preços reais, fees reais
  - Issues/delays
- [ ] Track total capital, total profit, running ROI
- **Effort:** 15h (manual hands-on)

#### Task 2.5: Cost Validation & Analysis
- [ ] Depois de 10 ciclos:
  - Compilar custos reais: bancária, plataforma, rede, etc
  - Compare vs. projeções em STRATEGY.md
  - Identificar discrepâncias
- [ ] Análise de:
  - Qual par foi mais rentável?
  - Qual foi o spread mais alto capturado?
  - Qual foi a maior perda?
  - Average time-to-settlement?
- [ ] Documentar em `PHASE2_VALIDATION.md`
- **Effort:** 4h

#### Task 2.6: Pain Point Analysis & Learnings
- [ ] Identificar:
  - Qual etapa foi mais lenta?
  - Qual etapa teve mais risco?
  - Quais foram as dificuldades operacionais?
- [ ] Propor soluções (inputs para PHASE 3 automação)
- [ ] Documentar em `PHASE2_LEARNINGS.md`
- **Effort:** 2h

#### Task 2.7: Decision Gate
- [ ] Revisar resultados:
  - [ ] >= 90% das transações resultaram em lucro?
  - [ ] Custos reais dentro de ±10% das projeções?
  - [ ] Seu retorno esperado é atrativo?
- [ ] **GO/NO-GO decision para PHASE 3**
- **Effort:** 1h

---

**PHASE 2 TOTAL EFFORT:** ~38h (2 semanas, part-time para User, full-time para Dev)  
**Expected Outcome:**
- 10-20 ciclos completados
- Validação de PnL real
- Documentação de pain points + learnings

---

## PHASE 3: Semi-Automation (Semana 5-6)

### Objetivo
Automatizar a etapa de COMPRA em Binance P2P + transfer de USDT. Manter venda manual (mais complexa, requer validação de buyer).

### Tasks

#### Task 3.1: Binance Trader Integration
- [ ] Implementar `lib/p2p/binance-trader.ts`:
  ```typescript
  export class BinanceTrader {
    async createBuyOrder(
      usdtAmount: number,
      maxPrice: number,
      merchantId?: string
    )
    async getOrderStatus(orderId: string)
    async confirmBuyOrder(orderId: string)
  }
  ```
- [ ] Testar com Binance sandbox (se disponível)
- [ ] Implementar retry logic + error handling
- [ ] Logging de cada tentativa
- **Effort:** 8h | **Owner:** Dev

#### Task 3.2: Auto-Transfer (Polygon)
- [ ] Implementar `lib/p2p/polygon-transfer.ts`:
  - After buy confirmation, auto-transfer USDT-e via Polygon
  - Use Ethers.js para enviar transação
  - Aguardar block confirmation
  - Log transaction hash
- [ ] Safety checks:
  - Verify receiver address é correto
  - Verificar balance é suficiente
  - Estimate gas fee antes de enviar
- **Effort:** 6h | **Owner:** Dev

#### Task 3.3: Orchestrator & Scheduler
- [ ] Criar `lib/p2p/arbitrage-engine.ts`:
  - Monitor opportunities
  - Auto-trigger buy se spread >= threshold (configurable)
  - Auto-transfer
  - Send alert to User para "seller ad em LocalBitcoins"
- [ ] Implementar queue system (Bull/BullMQ) para cyclos
- [ ] Implement idempotency (não duplicar orders se retry)
- **Effort:** 8h | **Owner:** Dev

#### Task 3.4: Dashboard Updates
- [ ] Build UI para:
  - View current auto-cycle status
  - Incoming orders (do LocalBitcoins manual monitoring)
  - Quick-action button: "Vender via LocalBitcoins"
  - Cycle history com automation status
- [ ] Adicionar settings:
  - Min spread threshold para auto-buy
  - Max capital per cycle
  - Preferred pairs
- **Effort:** 6h | **Owner:** Dev + UI

#### Task 3.5: Testing & Scaling
- [ ] Testar com capital pequeno ($500-1000)
- [ ] Rodar 10-15 ciclos semi-automáticos
- [ ] Validar:
  - [ ] Auto-buy funciona 100% das vezes?
  - [ ] Timing é melhor que manual?
  - [ ] Errors são handled gracefully?
- [ ] Scale para $10K capital operacional
- **Effort:** 8h | **Owner:** Dev + User

#### Task 3.6: Documentation & Handoff
- [ ] Document automated buy workflow
- [ ] Create runbook para venda manual
- [ ] Alert handling procedures
- **Effort:** 2h | **Owner:** Dev

---

**PHASE 3 TOTAL EFFORT:** ~38h (2 semanas)  
**Expected Outcome:**
- 20-30 ciclos/mês com automation
- Buy phase completamente automatizada
- Tempo economizado (~5 min per cycle)
- Target ROI: >= 15%

---

## PHASE 4: Full Automation (Semana 7-8)

### Objetivo
End-to-end automation. LocalBitcoins sell + Wise settlement automáticos. Multi-pair simultânea. Production-ready com risk guardrails.

### Tasks

#### Task 4.1: LocalBitcoins Trader
- [ ] Implementar `lib/p2p/local-bitcoins-trader.ts`:
  ```typescript
  export class LocalBitcoinsTrader {
    async createSellAd(usdtAmount, minPrice): Promise<AdId>
    async getIncomingOrders(): Promise<Order[]>
    async confirmSaleAndRelease(orderId): Promise<Settlement>
  }
  ```
- [ ] Handle incoming order notifications (via webhook or polling)
- [ ] Auto-confirm quando buyer ratings são bons (>= 4/5)
- [ ] Risk checks: buyer age, transaction count, dispute history
- **Effort:** 10h | **Owner:** Dev

#### Task 4.2: Wise Settlement
- [ ] Implementar `lib/p2p/wise-settlement.ts`:
  ```typescript
  export class WiseSettler {
    async transfer(
      amount: number,
      fromCurrency: string,
      toCurrency: 'USD'
    ): Promise<TransferId>
    async getTransferStatus(id): Promise<Status>
  }
  ```
- [ ] Handle bank details mapping (NGN, BRL, KES → USD)
- [ ] Implement hold periods (wait 45+ days para chargeback window)
- [ ] Logging + audit trail
- **Effort:** 8h | **Owner:** Dev

#### Task 4.3: Risk Management Layer
- [ ] Implementar guardrails:
  - Max capital per cycle: $5,000
  - Min spread threshold: 2%
  - Max cycles in parallel: 5
  - Min buyer reputation: 4.5/5 stars
  - Hold period enforcement: 45+ days
- [ ] Monitoring:
  - Alert se ciclo fica "stuck" (> 2h)
  - Alert se chargeback detected
  - Alert se capital allocation exceeds limit
- [ ] Emergency manual override
- **Effort:** 10h | **Owner:** Dev

#### Task 4.4: Multi-Pair Orchestration
- [ ] Implement logic para rodar 3-5 pares simultaneamente:
  - USDT/NGN, USDT/BRL, BTC/IDR, USDT/KES
  - Independent queues per pair
  - Shared capital pool (allocate based on opportunity strength)
- [ ] Optimize capital allocation:
  - Highest spread → highest capital
  - Diversify risk across pairs
- **Effort:** 8h | **Owner:** Dev

#### Task 4.5: Monitoring & Observability
- [ ] Build comprehensive dashboard:
  - Real-time cycle status (buy, transfer, sell, settlement)
  - Live P&L tracking (daily, weekly, monthly)
  - Risk alerts + warnings
  - Cycle history + analytics
  - Error log + replay capability
- [ ] Implement Sentry/Datadog integration
- [ ] Daily report email (cycles, profit, status)
- **Effort:** 10h | **Owner:** Dev + UI

#### Task 4.6: Error Handling & Recovery
- [ ] Implement retry logic:
  - Failed buy → retry next opportunity
  - Stuck transfer → fallback to manual
  - Delayed seller → auto-cancel ad, relist
  - Chargeback detected → freeze capital, alert user
- [ ] Graceful degradation (auto-manual fallback)
- [ ] Audit trail para debugging
- **Effort:** 8h | **Owner:** Dev

#### Task 4.7: Load Testing & Stress Testing
- [ ] Testar con 3-5 pares simultâneos
- [ ] Testar com capital large ($10K+)
- [ ] Testar con edge cases:
  - Network failures
  - API timeouts
  - High volatility
  - Multiple orders stuck
- [ ] Ensure 99.9% uptime
- **Effort:** 6h | **Owner:** Dev + QA

#### Task 4.8: Documentation & Deployment
- [ ] Complete runbooks
- [ ] API documentation
- [ ] Disaster recovery procedures
- [ ] Deploy to production
- [ ] Monitoring + alerting live
- **Effort:** 4h | **Owner:** Dev

---

**PHASE 4 TOTAL EFFORT:** ~64h (2 semanas, full-time)  
**Expected Outcome:**
- 50-100 ciclos/mês automaticamente
- Zero manual intervention (except emergencies)
- Monthly ROI: >= 30-50%
- Production-ready system

---

## TIMELINE & RESOURCE ALLOCATION

```
WEEK 1-2: PHASE 1 (Market Validation)
├─ Dev: 30h (part-time)
├─ User: 5h (approvals, decision)
└─ Output: Monitoring dashboard + market data

WEEK 3-4: PHASE 2 (Manual Execution)
├─ Dev: 15h (setup, logging, analytics)
├─ User: 20h (hands-on cycle execution)
└─ Output: 10-20 cycles, validation data

WEEK 5-6: PHASE 3 (Semi-Automation)
├─ Dev: 38h (full-time)
├─ User: 8h (testing, tuning)
└─ Output: Auto-buy pipeline, 20-30 cycles

WEEK 7-8: PHASE 4 (Full Automation)
├─ Dev: 64h (full-time)
├─ User: 5h (approval, tuning)
└─ Output: End-to-end automation, 50-100 cycles

TOTAL: ~152h dev, ~38h user, 8 weeks
```

---

## DECISION GATES & GO/NO-GO CRITERIA

| Gate | Phase | Criteria | Owner | Status |
|------|-------|----------|-------|--------|
| Capital & Jurisdição | Pre-P1 | $5K-10K USD available, KYC plan | User | ⏳ |
| Market Validation | P1→P2 | >= 5 spreads > 3%/dia em 2+ pares | System | ⏳ |
| PnL Validation | P2→P3 | >= 90% profitable, costs ±10% | User | ⏳ |
| API Access | Pre-P3 | Binance trader API approved | Binance | ⏳ |
| Automation Ready | P3→P4 | LB API tested, fail-safes in place | Dev | ⏳ |
| Scaling Approval | P4 | >= 30% ROI, < 2% chargeback | User | ⏳ |

---

## SUCCESS METRICS

### Phase 1 Success:
- ✅ Dashboard deployed & live
- ✅ >= 5 opportunities/day with spread >= 3%
- ✅ < 5% false positives
- ✅ Realistic spread average identified

### Phase 2 Success:
- ✅ 10-20 cycles completed
- ✅ >= 90% profitable
- ✅ Costs validated ±10%
- ✅ Pain points documented

### Phase 3 Success:
- ✅ 20-30 cycles/mês with auto-buy
- ✅ >= 95% auto success rate
- ✅ 5+ min saved per cycle
- ✅ ROI >= 15%

### Phase 4 Success:
- ✅ 50-100 cycles/mês fully automated
- ✅ >= 99% success rate
- ✅ < 2% chargeback rate
- ✅ ROI >= 30%
- ✅ Zero manual intervention needed

---

## RISKS & MITIGATIONS

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Binance API approval delayed | Medium | High | Pre-apply, have fallback (manual) |
| Spreads < 3% consistently | Low | High | Pivot to larger capital or new pairs |
| High chargeback rate | Low | High | Conservative merchant selection, 45d hold |
| Regulatory changes | Low | Medium | Monitor news, adjust quickly |
| System outage / crash | Very Low | High | Monitoring, error handling, manual fallback |

---

## DEPENDENCIES

- Binance P2P merchant approval
- LocalBitcoins merchant status
- Wise API access
- Polygon network stability
- Supabase performance
- Market liquidity in top 5 pairs

---

## NOTES

- **Start Date:** Ready as soon as PHASE 1 approval is given
- **Flexibility:** Can pivot pairs/strategies based on Phase 1 data
- **Communication:** Daily standup during Phases 3-4
- **Documentation:** Each phase produces detailed report for next phase

---

**Last Updated:** 2026-08-14  
**Next Review:** When PHASE 1 is approved to begin

