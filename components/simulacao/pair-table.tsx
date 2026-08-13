"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollTable } from "@/components/ui/scroll-table";
import { ExecutionPlan, type PlanStep } from "@/components/execution-plan";
import { reputationLabel, reputationTone } from "@/lib/reputation";
import { cn, formatMzn, formatPct, formatUsdt } from "@/lib/utils";

export type PairRow = {
  id: string;
  buyMerchant: string;
  buyPrice: number;
  sellMerchant: string;
  sellPrice: number;
  spendMzn: number;
  receiveMzn: number;
  usdtAmount: number;
  netMzn: number;
  netPct: number;
  spreadPct: number;
  worstFinishRate: number | null;
  worstMonthOrders: number | null;
  buyStep: PlanStep;
  sellStep: PlanStep;
};

/**
 * As melhores combinações "compro a este, vendo àquele", com uma ordem de
 * cada lado.
 *
 * A varredura clássica começa sempre no anúncio mais barato e desce a
 * lista. Se esse anúncio só aceitar 800 MZN, o capital reparte-se por três
 * comerciantes — e paga três taxas fixas em vez de uma. Um anúncio uns
 * cêntimos mais caro, mas que aceite o valor todo de uma vez, pode render
 * bastante mais no fim. Esta tabela testa todas as combinações possíveis e
 * mostra as que ganham.
 */
export function PairTable({ rows }: { rows: PairRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(rows[0]?.id ?? null);

  if (rows.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[var(--muted)]">
          Não existe agora nenhuma combinação de um comerciante para comprar e outro para vender que dê lucro
          depois das taxas. Isto muda ao longo do dia — o sistema continua a vigiar e avisa-te.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--muted)]">
        Cada linha é uma operação completa com uma só ordem de cada lado — metade das taxas fixas e muito
        menos tempo exposto ao mercado. Toca numa linha para ver o plano de execução.
      </p>

      <ScrollTable maxHeight="none" className="max-h-none">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--surface-2)] text-left text-xs uppercase text-[var(--muted)] shadow-[0_1px_0_var(--border)]">
            <tr>
              <th className="w-8 px-3 py-2" />
              <th className="px-3 py-2">Compras a</th>
              <th className="px-3 py-2">Vendes a</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2 text-right">Lucro líquido</th>
              <th className="px-3 py-2">Contrapartes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isOpen = expanded === r.id;
              const tone = reputationTone(r.worstFinishRate, r.worstMonthOrders);
              return (
                <Fragment key={r.id}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                    className={cn(
                      "cursor-pointer border-t border-[var(--border)] hover:bg-[var(--surface-2)]",
                      isOpen && "bg-[var(--surface-2)]"
                    )}
                  >
                    <td className="px-3 py-2 text-[var(--muted)]">
                      {isOpen ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {i === 0 ? <Badge tone="good">1º</Badge> : null}
                        <div className="min-w-0">
                          <div className="truncate">{r.buyMerchant}</div>
                          <div className="tabular text-xs text-[var(--muted)]">{formatMzn(r.buyPrice)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="truncate">{r.sellMerchant}</div>
                      <div className="tabular text-xs text-[var(--muted)]">{formatMzn(r.sellPrice)}</div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="tabular">{formatMzn(r.spendMzn)}</div>
                      <div className="tabular text-xs text-[var(--muted)]">{formatUsdt(r.usdtAmount)}</div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="tabular font-semibold text-[var(--good)]">+{formatMzn(r.netMzn)}</div>
                      <div className="tabular text-xs text-[var(--muted)]">{formatPct(r.netPct)}</div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={tone}>{reputationLabel(r.worstFinishRate, r.worstMonthOrders)}</Badge>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className="border-t border-[var(--border)] bg-[var(--surface-2)]">
                      <td colSpan={6} className="px-3 py-3">
                        <ExecutionPlan buySteps={[r.buyStep]} sellSteps={[r.sellStep]} netMzn={r.netMzn} />
                        <p className="mt-2 text-xs text-[var(--muted)]">
                          Diferença de preço entre os dois anúncios: {formatPct(r.spreadPct)}. Recebes{" "}
                          {formatMzn(r.receiveMzn)} em bruto.
                        </p>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </ScrollTable>
    </div>
  );
}
