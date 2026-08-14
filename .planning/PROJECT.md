# 🌍 Arbitragem P2P Internacional

**Project:** metical-edge → pivot para arbitragem P2P internacional  
**Owner:** [Usuário]  
**Status:** PLANNING  
**Created:** 2026-08-14  

---

## OVERVIEW

Transformar metical-edge de um monitor P2P localizado (USDT/MZN, falho com spreads de 0.2-0.5%) em uma **plataforma de arbitragem P2P internacional** com spreads reais de 2-8% em pares como USDT/NGN, USDT/BRL, BTC/IDR.

**Target ROI:** 30-50% ao mês com $10K capital  
**Timeline:** 8 semanas até automação completa  
**Viabilidade:** ✅ ALTAMENTE VIÁVEL (validado em análise)

---

> ⚠️ **CORREÇÃO (2026-08-14):** Onde este documento menciona "LocalBitcoins"
> como plataforma de contraparte — está desactualizado (encerrou o P2P em
> 2023). Ver correcção e plataforma substituta em [STRATEGY.md](../STRATEGY.md).

---

## VISION

> Um sistema que **identifica**, **executa**, e **liquidifica** ciclos de arbitragem P2P internacional automaticamente, com foco em pares de alta demanda de remessas (Nigéria, Brasil, Quênia) onde spreads excedem 3-8%.

---

## NORTH STAR METRICS

- **Monthly ROI:** Target 30-50% (com $10K capital base)
- **Spread Identification:** >= 5 oportunidades com spread > 3% por dia
- **Execution Success Rate:** >= 95% de ciclos completados
- **Time-to-Settlement:** <= 2 horas (buy → transfer → sell → settlement)
- **Capital Availability:** Máximo de capital operacional sem lock > 48h

---

## PHASES

### PHASE 1: Market Validation (Semana 1-2)
**Goal:** Validar que spreads > 3% ocorrem regularmente em top 5 pares.

- Deploy `/api/cron/arbitrage-scan` monitorando Binance P2P + LocalBitcoins
- Build dashboard de spreads em tempo real
- Collect 1 semana de dados reais
- Decision: Go/No-Go para Fase 2

**Expected Outcome:** Dashboard mostrando spread evolution, opportunity distribution

---

### PHASE 2: Manual Execution (Semana 3-4)
**Goal:** Execute 10-20 ciclos com capital real e validar PnL end-to-end.

- Setup contas (Binance P2P, LocalBitcoins, Wise)
- Executar ciclos manualmente (full hands-on)
- Validate custos reais vs. projeções
- Build ciclo tracking em Supabase

**Expected Outcome:** 
- 10-20 ciclos completados
- PnL log validando 0.5-1.5% spread líquido
- Identificação de pain points

---

### PHASE 3: Semi-Automation (Semana 5-6)
**Goal:** Automatizar compra em Binance P2P, manter venda manual.

- Implementar `BinanceTrader` class com API integration
- Auto-transfer USDT via Polygon
- Alertas para venda manual
- Scale para 20-30 ciclos/mês

**Expected Outcome:**
- Buy automation economiza 5+ min por ciclo
- 20-30 ciclos/mês com $10K capital
- ROI ≥ 15%

---

### PHASE 4: Full Automation (Semana 7-8)
**Goal:** End-to-end pipeline automático com guardrails.

- Integrar `LocalBitcoinsTrader` + venda automática
- Integrar `SettlementClient` (Wise automation)
- Risk management layer (max $5K/ciclo, hold periods)
- Multi-pair simultânea (3-5 pares)

**Expected Outcome:**
- 50-100 ciclos/mês fully automated
- ROI ≥ 30-50% mensal
- Minimal manual intervention

---

## DECISION GATES

| Gate | Phase | Criterion | Owner | Status |
|------|-------|-----------|-------|--------|
| Capital Ready | Pre-Phase 1 | $5K-10K USD disponível | User | ⏳ TO CONFIRM |
| Market Validation | Phase 1 → 2 | >= 5 spreads >3% por dia em 3+ pares | System | ⏳ PENDING |
| PnL Validation | Phase 2 → 3 | >= 90% ciclos rentáveis, custos dentro de ±10% | User | ⏳ PENDING |
| Automation Ready | Phase 3 → 4 | LocalBitcoins API testada, fail-safe em place | Dev | ⏳ PENDING |
| Scaling Approval | Phase 4 | >= 30% ROI mensal, chargeback < 2% | User | ⏳ PENDING |

---

## DEPENDENCIES & ASSUMPTIONS

**Dependencies:**
- Binance P2P API access (requires merchant KYC)
- LocalBitcoins API access (requires account + merchant verification)
- Wise API access (requires business account)
- Polygon network availability (for USDT transfers)

**Assumptions:**
- Spreads >= 3% disponíveis em 2+ pares diariamente
- Ciclos de 90 min em média completáveis
- Taxa de chargeback < 5%
- Regulação P2P estável durante implementação
- Demand by remessas sustentado em target markets

---

## ESTIMATED EFFORT & TIMELINE

| Phase | Duration | Effort | Complexity | Risk |
|-------|----------|--------|-----------|------|
| Phase 1: Validation | 2 weeks | 15h | Low | Low |
| Phase 2: Manual Exec | 2 weeks | 30h (manual) | Low | Medium |
| Phase 3: Semi-Auto | 2 weeks | 40h | Medium | Medium |
| Phase 4: Full-Auto | 2 weeks | 50h | High | High |
| **TOTAL** | **8 weeks** | **~135h** | **Medium** | **Medium** |

---

## SUCCESS CRITERIA (END OF PHASE 4)

✅ **Functionality:**
- [ ] Dashboard mostrando 5+ pares monitorados 24/7
- [ ] Automação de compra 100% funcional
- [ ] Automação de venda 100% funcional
- [ ] Settlement (Wise) 100% automático
- [ ] Multi-pair simultânea (3+ ciclos em paralelo)

✅ **Performance:**
- [ ] 50-100 ciclos/mês automaticamente
- [ ] Avg cycle time: 60-90 min
- [ ] Success rate: >= 95%
- [ ] Chargeback rate: < 2%

✅ **Financial:**
- [ ] Monthly ROI: >= 30%
- [ ] Total profit Mês 3: >= $15,000 (com $10K inicial)
- [ ] Break-even: <= Mês 1
- [ ] Scalable to $50K+ capital

✅ **Risk Management:**
- [ ] Guardrails implementados (max $5K/ciclo)
- [ ] Hold periods enforced (24-48h)
- [ ] Error handling & retry logic
- [ ] Emergency manual override

---

## BLOCKERS & RISKS

**Known Blockers:**
- [ ] Binance P2P API access requer approval merchant (pode levar 1-2 semanas)
- [ ] LocalBitcoins API access requer merchant status
- [ ] Wise API setup requer business account verification

**Key Risks:**
1. **Regulatory** (2-3%): Restrições P2P em certas jurisdições
2. **Counterparty** (3-5%): Chargeback ou "change of mind" buyers
3. **Liquidity** (5-10%): Falta de buyers durante baixa de spread
4. **Volatilidade** (1-2%): Preço muda durante ciclo longo

**Mitigation Plan:**
- Monitorar regulatory changes weekly
- Implementar hold periods de 45+ dias para chargeback protection
- Multi-pair diversification
- Fixed-price contracts durante ciclo

---

## OPEN QUESTIONS

1. **Capital:** Confirmar $10K USD disponível para operação? Ou começar menor ($5K)?
2. **Jurisdição:** Qual é sua "base" legal? Impacta KYC/regulação em P2P.
3. **Timing:** Quer fazer Fase 1 esta semana? Ou mais exploratory primeiro?
4. **Risk Appetite:** Máximo de capital locked "in-flight" que você aceitaria? ($1K? $5K?)
5. **Automation Level:** Prefere "sempre automático" ou "automático com human review" para ciclos grandes?

---

## ATTACHED DOCUMENTS

- [STRATEGY.md](../STRATEGY.md) — Full market analysis, financial projections, technical stack
- [ROADMAP.md](./ROADMAP.md) — Fases detalhadas com tasks + timing
- [RESEARCH.md](./research/) — Market data, spread history, regulatory landscape

---

## NEXT STEPS

1. **This week:** Revisar STRATEGY.md, confirmar capital & jurisdição
2. **Week 1-2:** Execute PHASE 1 (deploy monitoring dashboard)
3. **Week 3-4:** Execute PHASE 2 (manual cycles com capital real)
4. **Week 5+:** Phase 3 & 4 based on PHASE 2 validation

---

**Last Updated:** 2026-08-14  
**Next Review:** 2026-08-21 (post-Phase 1)  

