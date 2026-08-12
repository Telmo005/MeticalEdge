# MeticalEdge

Monitor autónomo do mercado USDT/MZN no Binance P2P. Varre o livro
periodicamente, avalia a estratégia de **captura de spread cruzado** (ver
relatório original) contra o capital que configurares, e envia um alerta
push para o teu telemóvel quando encontra uma oportunidade real que cumpre
todas as regras de entrada. Cada operação que executares na Binance é
reportada de volta ao sistema, o que faz o capital configurado evoluir
sozinho.

Não é um bot que negoceia por ti — a Binance não expõe uma API pública para
tomar anúncios de P2P automaticamente. É um sistema de vigilância e registo:
ele decide *quando* vale a pena olhar, tu executas manualmente na app da
Binance, e depois confirmas aqui o que aconteceu.

## Arquitectura

- **Next.js 16** (App Router, TypeScript) — mesmo stack do Duelo.
- **Supabase** — schema Postgres próprio `metical_edge` dentro de um
  projecto Supabase já existente (reaproveitado, não um projecto novo).
  Ver `supabase/migrations/0001_init.sql` para o porquê de não usar RLS
  policies/PostgREST aqui: único utilizador de confiança, tudo passa pelo
  servidor Next.js via ligação directa Postgres (Drizzle).
- **Supabase Auth** — só para o login (mono-utilizador); os dados da app
  não passam pelo PostgREST.
- **Cron externo** (cron-job.org, mesmo padrão do Duelo) chama
  `/api/cron/scan` a cada N minutos, autenticado por `CRON_SECRET`.
- **Alertas** — via o gateway de mensagens partilhado (o mesmo
  `payment gateway` que o Duelo usa) — push Android real para o teu
  telemóvel via celular-gateway. Ver `lib/messaging-client.ts`.
- **Motor de análise** (`lib/p2p/`) — porte directo para TypeScript do
  `p2p_mzn_analyzer` em Python (a ferramenta original que gerou o
  relatório): mesmo cliente da API pública do Binance P2P, mesma simulação
  de execução com profundidade real do livro, mesmos custos/taxas.

## Setup

### 1. Base de dados (Supabase)

Este sistema reaproveita um projecto Supabase que já tenhas. No **SQL
Editor** desse projecto, corre o conteúdo de
`supabase/migrations/0001_init.sql` uma vez — cria o schema `metical_edge`
e todas as tabelas, sem tocar em nada que já exista no projecto (schema
isolado, sem GRANTs para `anon`/`authenticated`).

Depois preenche `.env` (copia de `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=      # Project Settings -> API -> Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Project Settings -> API -> anon public key
DATABASE_URL=                  # Project Settings -> Database -> Connection string
                                # USA O TRANSACTION POOLER (porta 6543!), não o session pooler
```

### 2. Conta de login

Não há página de registo (é mono-utilizador). No dashboard do Supabase:
**Authentication -> Users -> Add user** — cria o teu email/password ali.
É essa conta que usas em `/login`.

### 3. Alertas (gateway de mensagens)

`.env` já vem com `MESSAGING_BASE_URL` e `MESSAGING_API_KEY` preenchidos a
partir do `payment gateway` local (copiados do `PUBLIC_BASE_URL` e
`CRON_SECRET` desse projecto — ver `docs/ENDPOINTS.md` lá: os endpoints de
mensagens autenticam com o próprio `CRON_SECRET` do gateway, não uma chave
por-app). Em produção, aponta `MESSAGING_BASE_URL` para o domínio publicado
do gateway em vez de `localhost`.

### 4. Rodar localmente

```bash
npm install
npm run dev
```

Para testar a varredura sem esperar pelo cron:

```bash
curl -H "Authorization: Bearer $(grep ^CRON_SECRET .env | cut -d= -f2)" http://localhost:3000/api/cron/scan
```

### 5. Deploy (Vercel, como o Duelo)

1. `vercel` / importar o repo no dashboard da Vercel.
2. Copiar todas as variáveis de `.env` para o projecto na Vercel
   (Settings -> Environment Variables) — usar a URL de produção do gateway
   de mensagens em `MESSAGING_BASE_URL`, não `localhost`.
3. Não há cron nativo configurado (`vercel.json` vazio, mesmo padrão do
   Duelo) — agendar em **cron-job.org**:
   - URL: `https://<domínio-do-deploy>/api/cron/scan`
   - Header: `Authorization: Bearer <CRON_SECRET>`
   - Intervalo: **1 minuto** (o plano gratuito do cron-job.org permite). A
     janela de spread cruzado dura minutos, não horas — quanto mais espaçada
     a varredura, maior a hipótese de a perder por completo.
   - Cada varredura só grava um novo snapshot/oportunidade e só dispara um
     alerta novo depois do `alert_cooldown_minutes` configurado em
     `/settings` (por omissão 20 min) — correr o cron a cada minuto não
     satura de alertas, só reduz o atraso até detectar uma janela nova.

## Como usar

1. Em **/settings**, define o capital inicial disponível para a estratégia
   e ajusta as regras de entrada se quiseres (os valores por omissão
   reproduzem exactamente a Secção 10 do relatório original).
2. O cron varre o mercado sozinho. Quando uma oportunidade cumpre todas as
   regras, chega um push ao telemóvel e fica registada em **/** (painel).
3. Executas a operação manualmente na app da Binance.
4. Voltas a **/trades/new** (a partir do link na oportunidade, ou
   directamente) e registas o que aconteceu de facto — preço real, USDT
   negociado, lucro líquido real. O capital em `/settings` actualiza-se
   sozinho a partir daqui, e as próximas varreduras já usam o novo valor.

## Limitações conhecidas (herdadas do relatório original)

- A margem desta estratégia é fina (tipicamente 0,2%–0,5% líquido por
  operação) e depende de execução rápida — o alerta chega, mas a janela
  pode fechar antes de executares as duas pernas.
- O capital mínimo real observado é ~2.000 MZN — abaixo disso os limites
  mínimos dos anúncios normalmente bloqueiam a operação (ver regras de
  entrada em `/settings`).
- A taxa "taker" exacta da Binance por ordem não é pública sem login —
  `lib/p2p/fees.ts` usa um intervalo conservador/médio/optimista, igual ao
  relatório original.
