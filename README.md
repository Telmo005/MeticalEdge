# MeticalEdge

Robô de arbitragem cross-exchange entre Binance e Bybit (spot). Compara os
livros de ordens das duas exchanges para os pares vigiados, calcula o
resultado líquido real (taxas + slippage + margem de segurança) e só
executa — comprar numa, vender na outra, quase em simultâneo — quando esse
resultado é mesmo positivo. Se não houver oportunidade suficientemente boa,
não faz nada — nunca força uma operação só para gerar actividade.

O capital fica sempre **pré-distribuído** nas duas exchanges (USDT para
comprar numa, o activo já reservado para vender na outra) e **nunca é
transferido** entre elas durante a arbitragem — evita risco de blockchain,
tempo de confirmação e taxas de retirada. Depois de várias operações os
saldos das duas podem ficar desequilibrados; o robô só informa
("rebalanceamento recomendado"), nunca transfere sozinho.

Não é um simulador: com chaves API configuradas nas duas exchanges,
liga-se às contas reais, verifica os saldos reais, executa ordens reais e
regista o resultado real. Sem chaves numa das duas, corre em modo
só-leitura — encontra e regista oportunidades reais, mas nunca executa
nada.

## Arquitectura

Dois processos, uma base de dados Postgres partilhada (Supabase, schema
`metical_edge`):

- **App Next.js (dashboard)** — painel, oportunidades, histórico e
  configurações. Só lê/escreve na base de dados (saldos, limites, kill
  switch); nunca fala directamente com as exchanges.
- **Worker (`worker/index.ts`)** — processo Node sempre-ligado, corrido à
  parte (não em serverless): a cada poucos segundos lê `bot_settings`,
  sincroniza saldos/inventário das duas exchanges, compara os pares
  vigiados nas duas direcções (`lib/arbitrage/scanner.ts`,
  `lib/arbitrage/opportunity-engine.ts`) contra livros de ordens reais, e —
  só se passarem todos os filtros de segurança (`lib/arbitrage/safety.ts`)
  e houver chaves API nas duas exchanges — executa
  (`lib/execution/executor.ts`, com recuperação de perna incompleta em
  `lib/execution/recovery.ts`). Corre fora do Vercel de propósito: precisa
  de um loop contínuo (não cron a cada minuto) e beneficia de um IP fixo
  para restringir as API keys.

Cada exchange tem o seu próprio adaptador (`lib/exchange/binance.ts`,
`lib/exchange/bybit.ts`) implementando a interface comum
`ExchangeAdapter` (`lib/exchange/types.ts`) — arquitectura preparada para
adicionar uma terceira exchange mais tarde, sem tocar no motor de
oportunidades nem no executor.

Módulos partilhados pelos dois processos vivem em `lib/` e `db/`. Alguns
ficheiros usam `import "server-only"` (protecção do Next.js contra
importar código de servidor em componentes cliente) — esses não podem ser
importados pelo worker; onde o worker precisa da mesma lógica, importa a
versão "core" sem esse guard (`lib/errorLog.core.ts`, `lib/queries.core.ts`).

## Setup

### 1. Base de dados (Supabase)

Reaproveita um projecto Supabase existente. As migrações em
`supabase/migrations/` criam e mantêm o schema `metical_edge` — corre
`npm run db:migrate` (ou aplica manualmente no SQL Editor se preferires).

```
NEXT_PUBLIC_SUPABASE_URL=      # Project Settings -> API -> Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Project Settings -> API -> anon public key
DATABASE_URL=                  # Project Settings -> Database -> Connection string
                                # USA O TRANSACTION POOLER (porta 6543!), não o session pooler
```

### 2. Conta de login

Mono-utilizador, sem página de registo. No dashboard do Supabase:
**Authentication -> Users -> Add user**.

### 3. Chaves das exchanges

**Binance** (Account -> API Management -> Create API) e **Bybit**
(API Management -> Create New Key) — nas duas, activa **apenas** leitura +
trading spot, **nunca** saques/transferências. Sem restrição de IP, isso já
limita bem o estrago de uma key comprometida; com IP fixo (worker num VPS),
podes e deves restringir.

```
BINANCE_API_KEY=
BINANCE_API_SECRET=
BYBIT_API_KEY=
BYBIT_API_SECRET=
```

Sem chaves numa das duas exchanges, o worker corre em modo só-leitura
(encontra e regista oportunidades reais, nunca executa).

### 4. Alertas (gateway de mensagens)

`MESSAGING_BASE_URL` e `MESSAGING_API_KEY` — push (e SMS opcional) para o
teu telemóvel. Ver `lib/messaging-client.ts`.

### 5. Rodar localmente

```bash
npm install
npm run dev      # dashboard em http://localhost:3000
npm run worker   # worker (loop de scan/execução), processo à parte
```

### 6. Deploy

- **Dashboard**: Vercel, como sempre — copiar as variáveis de `.env` para
  o projecto.
- **Worker**: processo Node sempre-ligado num VPS pequeno (não Vercel —
  precisa de correr continuamente, não em serverless). `git clone` +
  `npm ci` + `.env` com as mesmas variáveis + as quatro chaves API +
  `npm run worker` sob um supervisor (`pm2` ou um serviço `systemd`) para
  reiniciar sozinho se cair.
- `/api/cron/scan` deixou de fazer varredura — passou a heartbeat-check:
  confirma que o worker continua a escrever em `bot_heartbeats` e avisa se
  parar de responder. Continua a precisar de um scheduler externo
  (cron-job.org, a cada minuto) apontado para lá com
  `Authorization: Bearer <CRON_SECRET>`.

## Como usar

1. Cria as API keys na Binance e na Bybit (passo 3 acima) e deposita o
   capital real com que vais começar: USDT na Binance (para comprar) e o
   valor equivalente já convertido no activo na Bybit (para vender) —
   tipicamente ~10 USDT em cada.
2. Em **/** (painel), confirma os dois saldos iniciais se ainda não
   tiveres chaves ligadas — com chaves, o worker sincroniza-os sozinho.
3. Arranca `npm run worker`. Ele compara continuamente as duas exchanges
   em cada par vigiado, nas duas direcções, e só executa quando o
   resultado líquido supera a margem de segurança configurada em
   **/settings**.
4. Acompanha em **/oportunidades** (ranking + motivos de rejeição) e
   **/operacoes** (histórico real de execuções, com desempenho por rota e
   por par).
5. **PARAR BOT** no painel escreve o kill switch na base de dados — o
   worker lê isso a cada iteração do loop (poucos segundos) e pára de
   abrir novas operações.

## Protecções de capital

- Tamanho por operação = `trade_size_pct` do saldo USDT livre da exchange
  compradora nesse ciclo, capado por `max_trade_usdt` — nunca o saldo
  inteiro de uma vez.
- Nunca executa sem reconfirmar preço, liquidez, inventário e margem em
  cima de dados frescos, imediatamente antes das ordens
  (`lib/execution/executor.ts`).
- As duas pernas são disparadas quase em simultâneo. Se uma não preencher
  por completo dentro de `max_execution_time_ms`, o Recovery Engine tenta
  **uma única vez** completá-la — sem sequências infinitas, sem martingale.
  Se mesmo assim ficar incompleta, o ciclo é registado como
  `partial_recovered`/`failed` com o motivo exacto, e o desequilíbrio entre
  as duas exchanges fica visível no painel (Rebalancing Monitor).
- Limite de perda diária e contador de erros consecutivos activam o kill
  switch sozinhos (`bot_settings.killSwitchEngaged`) e avisam por push.
