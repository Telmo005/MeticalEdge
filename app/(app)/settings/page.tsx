import { getSettings, getCapitalHistory, getRecentErrorLogs } from "@/lib/queries";
import {
  setCapitalFormAction,
  setMinDisplayProfitFormAction,
  setMinNetProfitAlertFormAction,
  updateRuleSettingsFormAction,
  resetRuleSettingsFormAction,
  updateAlertChannelsFormAction,
  updateCostSettingsFormAction,
} from "@/lib/actions/settings";
import { clearErrorLogsFormAction } from "@/lib/actions/error-logs";
import { RECOMMENDED_RULE_DEFAULTS } from "@/lib/rule-defaults";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, InputWithSuffix, Label, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { CapitalChart } from "@/components/capital-chart";
import { TestNotificationButton } from "@/components/test-notification-button";
import { ErrorLogsTable } from "@/components/error-logs-table";
import { formatMzn } from "@/lib/utils";

export default async function SettingsPage() {
  const [config, history, errorLogsList] = await Promise.all([
    getSettings(),
    getCapitalHistory(50),
    getRecentErrorLogs(30),
  ]);
  const chartHistory = [...history]
    .reverse()
    .map((h) => ({ changedAt: h.changedAt, resultingBalanceMzn: Number(h.resultingBalanceMzn) }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Configurações</h1>
        <p className="text-sm text-[var(--muted)]">
          Só quem gere o sistema deve mexer aqui. As regras de entrada definem quão exigente o sistema é
          antes de te avisar — mais apertadas significa menos alertas, mas mais seguros.
        </p>
      </div>

      <Card>
        <CardTitle>Capital disponível para a estratégia</CardTitle>
        <p className="mb-4 mt-1 text-sm text-[var(--muted)]">
          O sistema só avalia oportunidades dentro deste valor. Cresce sozinho a cada operação bem-sucedida
          que reportares em /trades — só o ajustes aqui manualmente para o valor inicial ou uma correcção.
        </p>
        <form action={setCapitalFormAction} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currentCapitalMzn">Capital (MZN)</Label>
            <Input
              id="currentCapitalMzn"
              name="currentCapitalMzn"
              type="number"
              step="0.01"
              defaultValue={config?.currentCapitalMzn ?? undefined}
              className="w-full sm:w-48"
            />
          </div>
          <SubmitButton pendingText="A actualizar...">Actualizar</SubmitButton>
        </form>
      </Card>

      <Card>
        <CardTitle>Lucro mínimo a considerar</CardTitle>
        <p className="mb-4 mt-1 text-sm text-[var(--muted)]">
          Só te mostramos, por omissão, opções que rendem pelo menos este valor em Meticais. Sobe este número
          se quiseres ver só as oportunidades em que tens mais certeza — as restantes continuam visíveis,
          basta tocar em &ldquo;ver todas&rdquo; onde aparecerem.
        </p>
        <form action={setMinDisplayProfitFormAction} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="minDisplayProfitMzn">Lucro mínimo (MZN)</Label>
            <Input
              id="minDisplayProfitMzn"
              name="minDisplayProfitMzn"
              type="number"
              step="1"
              min="0"
              defaultValue={config?.minDisplayProfitMzn ?? undefined}
              className="w-full sm:w-48"
            />
          </div>
          <SubmitButton pendingText="A guardar...">Guardar</SubmitButton>
        </form>
      </Card>

      <Card>
        <CardTitle>Quando avisar-te</CardTitle>
        <p className="mb-4 mt-1 text-sm text-[var(--muted)]">
          Recebes um alerta sempre que a melhor forma de executar render, no mínimo, este valor de lucro
          <b> líquido</b> — já depois das taxas da Binance e do custo de transferir dinheiro. Zero significa
          avisar sempre que sobrar dinheiro real. Sobe o valor se estiveres a receber alertas de mais para
          operações pequenas demais para valerem a interrupção.
        </p>
        <form action={setMinNetProfitAlertFormAction} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="minNetProfitAlertMzn">Lucro líquido mínimo para avisar</Label>
            <InputWithSuffix
              id="minNetProfitAlertMzn"
              name="minNetProfitAlertMzn"
              type="number"
              step="1"
              min="0"
              suffix="MZN"
              defaultValue={config?.minNetProfitAlertMzn ?? undefined}
              className="w-full sm:w-56"
            />
          </div>
          <SubmitButton pendingText="A guardar...">Guardar</SubmitButton>
        </form>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Isto é diferente de &ldquo;Lucro mínimo a considerar&rdquo; acima: esse filtra o que aparece nas
          listas dentro da app, este decide se o telemóvel toca.
        </p>
      </Card>

      <Card>
        <CardTitle>Custo real de mover dinheiro</CardTitle>
        <p className="mb-4 mt-1 text-sm text-[var(--muted)]">
          Cada ordem P2P envolve uma transferência de Meticais, e isso custa dinheiro. Até aqui o cálculo de
          lucro só descontava a taxa da Binance e tratava as transferências como grátis — o que tornava todos
          os lucros mostrados optimistas. Numa operação de 5.000 MZN a diferença ronda os 30 MZN, muitas
          vezes mais do que a margem inteira.
        </p>
        <form action={updateCostSettingsFormAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="costRail">Como pagas e recebes</Label>
            <Select id="costRail" name="costRail" defaultValue={config?.costRail ?? "mpesa"}>
              <option value="mpesa">M-Pesa</option>
              <option value="emola">e-Mola</option>
              <option value="nenhum">Transferência sem custo (banco próprio, saldo interno)</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="transfersPerOrder">Transferências por ordem</Label>
            <InputWithSuffix
              id="transfersPerOrder"
              name="transfersPerOrder"
              type="number"
              min="1"
              max="10"
              step="1"
              suffix="envios"
              defaultValue={config?.transfersPerOrder ?? 1}
            />
            <p className="text-xs text-[var(--muted)]">
              Alguns comerciantes pedem o valor repartido em vários envios — e cada envio paga a sua taxa de
              escalão.
            </p>
          </div>
          <div className="col-span-1 flex items-start gap-2 sm:col-span-2">
            <input
              id="includeCashOut"
              name="includeCashOut"
              type="checkbox"
              defaultChecked={config?.includeCashOut}
              className="mt-0.5 h-4 w-4"
            />
            <Label htmlFor="includeCashOut" className="normal-case">
              Contar também o levantamento no fim de cada operação. Deixa desligado se reinvestes o saldo em
              vez de o levantares — que é o caso normal de quem opera em ciclo.
            </Label>
          </div>
          <div className="col-span-1 sm:col-span-2">
            <SubmitButton pendingText="A guardar...">Guardar custos</SubmitButton>
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Regras de entrada (avançado)</CardTitle>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Um alerta só é enviado quando TODAS estas condições se cumprem — ver Secção 10 do relatório
              original. O número entre parêntesis é o valor recomendado.
            </p>
          </div>
        </div>
        <form action={updateRuleSettingsFormAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="minGrossSpreadPct">
              Spread bruto mínimo (%) <span className="normal-case text-[var(--muted)]">(recomendado {RECOMMENDED_RULE_DEFAULTS.minGrossSpreadPct})</span>
            </Label>
            <Input
              id="minGrossSpreadPct"
              name="minGrossSpreadPct"
              type="number"
              step="0.01"
              defaultValue={config?.minGrossSpreadPct ?? undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="minNetPctAlert">
              Lucro líquido mínimo p/ alertar (%) <span className="normal-case text-[var(--muted)]">(recomendado {RECOMMENDED_RULE_DEFAULTS.minNetPctAlert})</span>
            </Label>
            <Input
              id="minNetPctAlert"
              name="minNetPctAlert"
              type="number"
              step="0.01"
              defaultValue={config?.minNetPctAlert ?? undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="minCounterpartyFinishRate">
              Taxa de conclusão mínima da contraparte{" "}
              <span className="normal-case text-[var(--muted)]">(recomendado {RECOMMENDED_RULE_DEFAULTS.minCounterpartyFinishRate})</span>
            </Label>
            <Input
              id="minCounterpartyFinishRate"
              name="minCounterpartyFinishRate"
              type="number"
              step="0.01"
              min="0"
              max="1"
              defaultValue={config?.minCounterpartyFinishRate ?? undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="minCounterpartyMonthlyOrders">
              Ordens/mês mínimas da contraparte{" "}
              <span className="normal-case text-[var(--muted)]">(recomendado {RECOMMENDED_RULE_DEFAULTS.minCounterpartyMonthlyOrders})</span>
            </Label>
            <Input
              id="minCounterpartyMonthlyOrders"
              name="minCounterpartyMonthlyOrders"
              type="number"
              defaultValue={config?.minCounterpartyMonthlyOrders ?? undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="maxOrdersPerLeg">
              Máx. ordens por perna <span className="normal-case text-[var(--muted)]">(recomendado {RECOMMENDED_RULE_DEFAULTS.maxOrdersPerLeg})</span>
            </Label>
            <Input
              id="maxOrdersPerLeg"
              name="maxOrdersPerLeg"
              type="number"
              defaultValue={config?.maxOrdersPerLeg ?? undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="alertCooldownMinutes">
              Intervalo mínimo entre alertas (min){" "}
              <span className="normal-case text-[var(--muted)]">(recomendado {RECOMMENDED_RULE_DEFAULTS.alertCooldownMinutes})</span>
            </Label>
            <Input
              id="alertCooldownMinutes"
              name="alertCooldownMinutes"
              type="number"
              defaultValue={config?.alertCooldownMinutes ?? undefined}
            />
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
              Varredura activa (desliga para pausar o monitoramento sem apagar dados)
            </Label>
          </div>
          <div className="col-span-1 flex flex-wrap gap-3 sm:col-span-2">
            <SubmitButton pendingText="A guardar...">Guardar regras</SubmitButton>
            <SubmitButton
              variant="secondary"
              formAction={resetRuleSettingsFormAction}
              pendingText="A repor..."
              confirmMessage="Repor as 6 regras de entrada para os valores recomendados? Isto substitui o que tens configurado agora."
            >
              Repor valores recomendados
            </SubmitButton>
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>Alertas — push e SMS</CardTitle>
        <p className="mb-4 mt-1 text-sm text-[var(--muted)]">
          O push é sempre enviado. O SMS duplica o alerta — útil se o telemóvel não estiver com a app do
          gateway aberta. Usa &ldquo;Testar notificações&rdquo; para confirmar que ambos chegam, sem esperar
          por uma oportunidade real.
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
        <CardTitle>Evolução do capital</CardTitle>
        <div className="mt-3">
          <CapitalChart history={chartHistory} />
        </div>
        <ul className="mt-4 flex flex-col gap-2 text-sm">
          {history.slice(0, 15).map((h) => (
            <li key={h.id} className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <span className="text-[var(--muted)]">
                {new Date(h.changedAt).toLocaleString("pt-PT")} — {h.reason}
              </span>
              <span className="tabular">
                {Number(h.deltaMzn) >= 0 ? "+" : ""}
                {formatMzn(h.deltaMzn)} → {formatMzn(h.resultingBalanceMzn)}
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
              Qualquer erro do lado do servidor (varredura falhada, base de dados indisponível, etc.) fica
              registado aqui automaticamente e dispara um push na hora.
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
