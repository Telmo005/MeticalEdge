import { getBotSettings, getCapitalHistory, getExchangeBalances, getRecentCapitalLedgerEntries, getRecentErrorLogs } from "@/lib/queries";
import { setExchangeBalanceFormAction, setModeFormAction, updateBotSettingsFormAction } from "@/lib/actions/bot";
import { updateAlertChannelsFormAction } from "@/lib/actions/settings";
import { clearErrorLogsFormAction } from "@/lib/actions/error-logs";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, InputWithSuffix, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { CapitalChart } from "@/components/capital-chart";
import { TestNotificationButton } from "@/components/test-notification-button";
import { ErrorLogsTable } from "@/components/error-logs-table";
import { formatUsdt } from "@/lib/utils";

export default async function SettingsPage() {
  const [config, exchangeBalances, chartHistory, ledgerEntries, errorLogsList] = await Promise.all([
    getBotSettings(),
    getExchangeBalances(),
    getCapitalHistory(50),
    getRecentCapitalLedgerEntries(15),
    getRecentErrorLogs(30),
  ]);
  const binanceBalance = exchangeBalances.find((b) => b.exchangeId === "binance");
  const bybitBalance = exchangeBalances.find((b) => b.exchangeId === "bybit");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Configurações</h1>
        <p className="text-sm text-[var(--muted)]">
          Estes valores controlam directamente o risco do robô — o worker lê-os a cada iteração do loop.
        </p>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>Modo de operação</CardTitle>
          <Badge tone={config?.mode === "live" ? "critical" : "neutral"}>{config?.mode === "live" ? "🔴 REAL" : "⚪ SIMULAÇÃO"}</Badge>
        </div>
        <p className="mb-4 mt-1 text-sm text-[var(--muted)]">
          Em <b>Paper</b> o robô nunca envia ordens reais, mesmo que haja chaves API configuradas — só simula com
          dados de mercado reais. Muda para <b>Live</b> só depois de validares os resultados simulados.
        </p>
        <div className="flex flex-wrap gap-3">
          <form action={setModeFormAction}>
            <input type="hidden" name="mode" value="paper" />
            <SubmitButton
              variant={config?.mode === "paper" ? "primary" : "secondary"}
              pendingText="A mudar..."
              disabled={config?.mode === "paper"}
            >
              ⚪ Paper (simulação)
            </SubmitButton>
          </form>
          <form action={setModeFormAction}>
            <input type="hidden" name="mode" value="live" />
            <SubmitButton
              variant={config?.mode === "live" ? "primary" : "danger"}
              pendingText="A mudar..."
              disabled={config?.mode === "live"}
              confirmMessage="Mudar para modo LIVE? O robô vai poder enviar ordens reais assim que houver uma oportunidade válida e chaves API configuradas nas duas exchanges."
            >
              🔴 Live (dinheiro real)
            </SubmitButton>
          </form>
        </div>
      </Card>

      <Card>
        <CardTitle>Saldo real por exchange</CardTitle>
        <p className="mb-4 mt-1 text-sm text-[var(--muted)]">
          Corrige aqui só depois de um depósito/levantamento fora do ciclo do robô. Com chaves API configuradas
          nas duas exchanges, o worker sincroniza estes valores sozinho a cada iteração do loop.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <form action={setExchangeBalanceFormAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="exchangeId" value="binance" />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="binanceValueUsdt">Binance (USDT)</Label>
              <Input
                id="binanceValueUsdt"
                name="valueUsdt"
                type="number"
                step="0.00000001"
                defaultValue={binanceBalance?.totalValueUsdt ?? undefined}
                className="w-full sm:w-48"
              />
            </div>
            <SubmitButton pendingText="A actualizar...">Actualizar</SubmitButton>
          </form>
          <form action={setExchangeBalanceFormAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="exchangeId" value="bybit" />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bybitValueUsdt">Bybit (USDT)</Label>
              <Input
                id="bybitValueUsdt"
                name="valueUsdt"
                type="number"
                step="0.00000001"
                defaultValue={bybitBalance?.totalValueUsdt ?? undefined}
                className="w-full sm:w-48"
              />
            </div>
            <SubmitButton pendingText="A actualizar...">Actualizar</SubmitButton>
          </form>
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <CardTitle>Risco e execução (avançado)</CardTitle>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Ver secções 5, 7 e 9 do desenho original. Mudanças aqui têm efeito real no dinheiro operado.
          </p>
        </div>
        <form action={updateBotSettingsFormAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tradeSizePct">% do saldo por operação</Label>
            <InputWithSuffix
              id="tradeSizePct"
              name="tradeSizePct"
              type="number"
              step="0.1"
              min="0"
              max="100"
              suffix="%"
              defaultValue={config?.tradeSizePct ?? undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="maxTradeUsdt">Tecto por operação</Label>
            <InputWithSuffix
              id="maxTradeUsdt"
              name="maxTradeUsdt"
              type="number"
              step="0.01"
              min="0"
              suffix="USDT"
              defaultValue={config?.maxTradeUsdt ?? undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="minProfitPct">Lucro mínimo exigido</Label>
            <InputWithSuffix
              id="minProfitPct"
              name="minProfitPct"
              type="number"
              step="0.01"
              min="0"
              suffix="%"
              defaultValue={config?.minProfitPct ?? undefined}
            />
            <p className="text-xs text-[var(--muted)]">MIN_PROFIT_PERCENTAGE (secção 7) — antes da margem de segurança.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="minSafetyMarginPct">Margem de segurança adicional</Label>
            <InputWithSuffix
              id="minSafetyMarginPct"
              name="minSafetyMarginPct"
              type="number"
              step="0.01"
              min="0"
              suffix="%"
              defaultValue={config?.minSafetyMarginPct ?? undefined}
            />
            <p className="text-xs text-[var(--muted)]">
              Só executa se lucro mínimo + margem for superado — absorve slippage e atraso entre avaliação e execução.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="maxExecutionTimeMs">Tempo máximo de execução</Label>
            <InputWithSuffix
              id="maxExecutionTimeMs"
              name="maxExecutionTimeMs"
              type="number"
              step="1000"
              min="1000"
              suffix="ms"
              defaultValue={config?.maxExecutionTimeMs ?? undefined}
            />
            <p className="text-xs text-[var(--muted)]">Prazo para as duas pernas confirmarem antes do Recovery Engine agir (secção 10).</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dailyLossLimitUsdt">Limite de perda diária</Label>
            <InputWithSuffix
              id="dailyLossLimitUsdt"
              name="dailyLossLimitUsdt"
              type="number"
              step="0.01"
              min="0"
              suffix="USDT"
              defaultValue={config?.dailyLossLimitUsdt ?? undefined}
            />
            <p className="text-xs text-[var(--muted)]">Se a perda do dia atingir isto, o robô pára-se sozinho.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="maxTradeLossUsdt">Perda máxima por operação</Label>
            <InputWithSuffix
              id="maxTradeLossUsdt"
              name="maxTradeLossUsdt"
              type="number"
              step="0.01"
              min="0"
              suffix="USDT"
              defaultValue={config?.maxTradeLossUsdt ?? undefined}
            />
            <p className="text-xs text-[var(--muted)]">Independente do limite diário — uma única operação muito má já pára o robô sozinha.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="maxConsecutiveErrors">Máx. erros consecutivos</Label>
            <Input
              id="maxConsecutiveErrors"
              name="maxConsecutiveErrors"
              type="number"
              min="1"
              defaultValue={config?.maxConsecutiveErrors ?? undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="maxConsecutiveLosses">Máx. perdas seguidas</Label>
            <Input
              id="maxConsecutiveLosses"
              name="maxConsecutiveLosses"
              type="number"
              min="1"
              defaultValue={config?.maxConsecutiveLosses ?? undefined}
            />
            <p className="text-xs text-[var(--muted)]">Trades reais sem lucro seguidos — diferente de erros técnicos, conta operações que &ldquo;correram bem&rdquo; mas deram prejuízo.</p>
          </div>
          <div className="col-span-1 flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="watchedPairs">Pares vigiados (Binance + Bybit)</Label>
            <Input
              id="watchedPairs"
              name="watchedPairs"
              type="text"
              defaultValue={config?.watchedPairs?.join(", ") ?? ""}
              placeholder="BTCUSDT, ETHUSDT"
            />
            <p className="text-xs text-[var(--muted)]">Separados por vírgula — o motor compara as duas exchanges em cada par, nas duas direcções (secção 18).</p>
          </div>
          <div className="col-span-1 flex items-center gap-2 sm:col-span-2">
            <input
              id="scanningEnabled"
              name="scanningEnabled"
              type="checkbox"
              defaultChecked={config?.scanningEnabled}
              className="h-4 w-4"
            />
            <Label htmlFor="scanningEnabled" className="normal-case">
              Varredura activa (desliga para pausar sem apagar dados)
            </Label>
          </div>
          <div className="col-span-1 sm:col-span-2">
            <SubmitButton pendingText="A guardar...">Guardar</SubmitButton>
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>Alertas — push e SMS</CardTitle>
        <p className="mb-4 mt-1 text-sm text-[var(--muted)]">
          O push é sempre enviado. O SMS duplica o alerta — útil se o telemóvel não estiver com a app do gateway
          aberta.
        </p>
        <form action={updateAlertChannelsFormAction} className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <input
              id="smsAlertsEnabled"
              name="smsAlertsEnabled"
              type="checkbox"
              defaultChecked={config?.smsAlertsEnabled}
              className="h-4 w-4"
            />
            <Label htmlFor="smsAlertsEnabled" className="normal-case">
              Enviar também por SMS
            </Label>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="alertPhoneE164">Número (formato internacional)</Label>
            <Input
              id="alertPhoneE164"
              name="alertPhoneE164"
              type="tel"
              placeholder="+258840000000"
              defaultValue={config?.alertPhoneE164 ?? undefined}
              className="w-full sm:w-64"
            />
          </div>
          <SubmitButton pendingText="A guardar..." className="self-start">
            Guardar canal SMS
          </SubmitButton>
        </form>

        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <TestNotificationButton />
        </div>
      </Card>

      <Card>
        <CardTitle>Evolução do saldo</CardTitle>
        <div className="mt-3">
          <CapitalChart history={chartHistory} />
        </div>
        <ul className="mt-4 flex flex-col gap-2 text-sm">
          {ledgerEntries.map((h) => (
            <li key={h.id} className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <span className="text-[var(--muted)]">
                {new Date(h.changedAt).toLocaleString("pt-PT")} — {h.exchangeId} — {h.reason}
              </span>
              <span className="tabular">
                {Number(h.deltaUsdt) >= 0 ? "+" : ""}
                {formatUsdt(h.deltaUsdt)} → {formatUsdt(h.resultingBalanceUsdt)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Erros recentes</CardTitle>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Qualquer erro do lado do servidor ou do worker fica registado aqui automaticamente e dispara um
              push na hora.
            </p>
          </div>
          {errorLogsList.length > 0 ? (
            <form action={clearErrorLogsFormAction}>
              <SubmitButton
                variant="danger"
                pendingText="A limpar..."
                confirmMessage="Apagar todos os erros registados? Isto não pode ser desfeito."
              >
                Limpar erros
              </SubmitButton>
            </form>
          ) : null}
        </div>
        <ErrorLogsTable logs={errorLogsList} />
      </Card>
    </div>
  );
}
