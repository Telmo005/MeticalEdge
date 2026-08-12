"use client";

import { useMemo, useState } from "react";

/** Ordenação de tabela genérica — usada em todas as tabelas da app para
 *  manter o mesmo comportamento (tocar no cabeçalho ordena, tocar outra vez
 *  inverte). `getValue` devolve o valor a comparar para uma dada chave. */
export function useSort<T, K extends string>(
  items: T[],
  getValue: (item: T, key: K) => string | number | null,
  defaultKey: K,
  defaultDir: "asc" | "desc" = "asc"
) {
  const [sortKey, setSortKey] = useState<K>(defaultKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultDir);

  const sorted = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      const av = getValue(a, sortKey);
      const bv = getValue(b, sortKey);
      let cmp: number;
      if (typeof av === "string" || typeof bv === "string") {
        cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      } else {
        cmp = (av ?? -Infinity) - (bv ?? -Infinity);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, sortKey, sortDir]);

  function toggleSort(key: K, fallbackDir: "asc" | "desc" = "desc") {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortDir(fallbackDir);
      }
      return key;
    });
  }

  return { sorted, sortKey, sortDir, toggleSort };
}
