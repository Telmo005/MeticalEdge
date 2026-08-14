# ✅ PRÓXIMOS PASSOS — Decisões Imediatas

**Sessão:** 2026-08-14  
**Projeto:** metical-edge → P2P Arbitrage Internacional  

---

> ⚠️ **CORREÇÃO (2026-08-14):** "LocalBitcoins" abaixo está desactualizado
> (encerrou o P2P em 2023) — ver plataforma substituta em [STRATEGY.md](../STRATEGY.md).
> Contas já confirmadas por ti nesta sessão; dev já começou o trabalho de
> Fase 1.

---

## 📋 DECISÕES QUE VOCÊ PRECISA TOMAR (AGORA)

### 1️⃣ CAPITAL & TIMELINE

```
❓ Pergunta: Tem $5K-10K USD disponível para operação?
├─ SIM, $5K  → Start PHASE 1 cautiously, scale gradualmente
├─ SIM, $10K → Full speed, melhor ROI potencial
├─ SIM, $50K → Escala profissional, mas burn-out risk é real
└─ NÃO     → Validar com menor capital primeiro

❓ Pergunta: Quando quer começar?
├─ ESTA SEMANA  → Acelera, decision gates em paralelo
├─ PRÓXIMA SEMANA → Tempo para KYC setup
└─ MÊS QUE VEM → Relaxado, mais research
```

### 2️⃣ JURISDIÇÃO & KYC

```
❓ Qual é seu "home base" (país de residência)?
├─ Afeta regulação P2P
├─ Afeta limites de volume em Binance/LocalBitcoins
├─ Afeta Wise setup (business account requirements)
└─ Precisa documentar ANTES de começar

❓ Status KYC atual?
├─ Binance já tem account + identity verified?
├─ Wise tem account (personal ou business)?
├─ LocalBitcoins tem account?
└─ Se "não" → Planejar 1-2 semanas de setup

KYC SETUP PLAN:
├─ Today: Pre-apply para Binance P2P merchant approval
├─ Tomorrow: Setup Wise business account
├─ Day 3-5: Apply para LocalBitcoins merchant
├─ Week 2: Confirmação de todas as aprovações
└─ Ready for PHASE 2 (manual execution)
```

### 3️⃣ RISK APPETITE

```
❓ Max capital locked "in-flight" por ciclo?
├─ $1,000 USD (conservative)
├─ $5,000 USD (balanced)
├─ $10,000 USD (aggressive)
└─ Isso afeta: chargeback risk, fail-safe design, automation level

❓ Nível de automação desejado?
├─ MANUAL: Tu executa cada passo (full control, slow)
├─ SEMI-AUTO: Auto compra, venda manual
├─ FULL-AUTO: End-to-end automático (precisa guardrails rígidos)
└─ Recomendação: Começar MANUAL (P1-P2), gradualmente auto

❓ Tolerância para volatilidade?
├─ Ciclo de 90min = risco de 0.5-2% preço change
├─ Está ok capturar margin menor para segurança?
└─ Isso afeta threshold de spreads mínimos para executar
```

---

## 📅 QUICK START PLAN (PRÓXIMAS 48h)

```
TODAY (14 Aug):
├─ ✅ Revisar STRATEGY.md (ler top 5 pares + financial model)
├─ ✅ Revisar ROADMAP.md (entender 4 phases)
├─ ⏳ Responder 3 perguntas acima (decisões)
└─ ⏳ Confirmar capital & timeline

TOMORROW (15 Aug):
├─ ⏳ Setup: Pre-apply Binance P2P merchant approval
├─ ⏳ Setup: Create Wise business account (email à Wise)
├─ ⏳ Setup: Create LocalBitcoins account
└─ ⏳ Send approval "GO for PHASE 1" ou "need more time"

DAY 3+ (16 Aug onwards):
├─ IF GO: Dev começa PHASE 1 (deploy monitoring dashboard)
├─ IF NEED TIME: Continue KYC setup, validar decisões
└─ Aguardar aprovações de merchant status (~1-2 weeks)

WEEK 2:
├─ Dashboard live + monitorando 24/7
├─ Coletando dados de spreads reais
├─ Compilando PHASE 1 results

WEEK 3-4:
├─ IF validation successful: Begin PHASE 2 (manual execution)
├─ Execute 10-20 ciclos com capital real
└─ Validate PnL end-to-end
```

---

## 📊 FINANCIAL REALITY CHECK

### Se começar com $10K USD:

```
MÊS 1 (PHASE 2: Manual):
├─ 5-10 ciclos
├─ Profit esperado: $1,500-2,500
├─ ROI: 15-25%
└─ Tempo gasto: ~30h (hands-on)

MÊS 2 (PHASE 3: Semi-auto):
├─ 15-20 ciclos
├─ Profit esperado: $7,000-10,000
├─ ROI: 70-100%
└─ Tempo gasto: ~10h (monitoring)

MÊS 3 (PHASE 4: Full-auto):
├─ 25-35 ciclos
├─ Profit esperado: $15,000-25,000
├─ ROI: 150-250%
└─ Tempo gasto: ~5h (monitoring)

ACUMULADO 3 MESES:
├─ Capital inicial: $10,000
├─ Lucro total: ~$23,500-37,500
├─ Capital final: $33,500-47,500
└─ ROI total: 235-375% ✅ MUITO VIÁVEL

Break-even: Fim do Mês 1
```

### Se começar com $5K USD:

```
Break-even: Fim do Mês 2 (capital pequeno = custos % maiores)
3-month profit: ~$12K-18K (metade de $10K scenario)
Recomendação: Começar $5K apenas se capital limitado
```

### Se começar com $1K USD:

```
Break-even: NUNCA (custos fixos > profit)
Recomendação: ❌ NÃO RECOMENDADO
```

---

## 🚨 CRITICAL DEPENDENCIES

**Sem essas coisas, o projeto NÃO PODE sair do ground:**

1. **Binance P2P Merchant Approval**
   - Status: ⏳ Need to apply
   - Timeline: 1-2 weeks typically
   - Blocker: If denied, strategy fails
   - Action: Pre-apply today

2. **Spreads >= 3% Daily**
   - Status: ⏳ Validating in PHASE 1
   - Timeline: 1 week data collection
   - Blocker: If spreads < 2%, margins too thin
   - Action: Monitor PHASE 1 dashboard results

3. **Capital Available**
   - Status: ⏳ User to confirm
   - Timeline: Need before PHASE 2
   - Blocker: If < $5K, not worth doing
   - Action: Confirm capital now

---

## 🎯 FINAL CHECKLIST (ANTES DE PHASE 1)

```
PRÉ-REQUISITOS:
─────────────────────────────────
☐ Capital confirmado ($5K-10K USD)
☐ Jurisdição declarada
☐ Risk appetite defined (max $$ per cycle, automation level)
☐ Binance P2P merchant applied
☐ Wise business account setup started
☐ LocalBitcoins account created
☐ STRATEGY.md + ROADMAP.md reviewed

DELIVERABLES CRIADOS:
─────────────────────────────────
✅ STRATEGY.md (complete strategy + financials)
✅ .planning/PROJECT.md (vision + metrics)
✅ .planning/ROADMAP.md (4-phase detailed breakdown)
✅ Session notes + next steps

READY FOR PHASE 1?
─────────────────────────────────
❓ Todas decisões confirmadas?
❓ KYC setup iniciado?
❓ Capital ready?
→ Se SIM: Começa PHASE 1 esta semana
→ Se NÃO: Aguarda setup, retorna em 5-7 dias
```

---

## 💬 PRÓXIMA AÇÃO (VOCÊ)

**Respond com:**

```
1. Capital disponível: $_____ USD
2. Timeline: Esta semana / Próxima semana / Mês que vem
3. Jurisdição/País: _________
4. Max capital per cycle: $_____ USD
5. Automação desejada: Manual / Semi-auto / Full-auto
6. Status KYC: [Se tem contas já aberta]
7. Aprovação para começar PHASE 1? SIM / NÃO / Preciso tempo
```

---

## 📞 SUPORTE NECESSÁRIO?

- **Setup KYC:** Posso guiar passo-a-passo
- **Technical questions:** Revisar STRATEGY.md section 5
- **Financial modeling:** Revisar STRATEGY.md section 4
- **Timeline concerns:** Discutir flexibilidade

---

**Status:** ✅ Estratégia completa, aguardando suas decisões  
**Próximo:** PHASE 1 assim que aprovado

