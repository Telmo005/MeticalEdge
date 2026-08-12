/** Câmbio USD/MZN de mercado aberto — só para contexto, nunca para presumir
 *  arbitragem (ver relatório original: o prémio P2P sobre este câmbio
 *  reflete controlo cambial, não é capturável). Porte de reference_price.py. */
export async function fetchUsdMznReference(): Promise<{ usdMzn: number; source: string } | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = await res.json();
    if (body.result !== "success") return null;
    return { usdMzn: body.rates.MZN, source: "open.er-api.com" };
  } catch {
    return null;
  }
}
