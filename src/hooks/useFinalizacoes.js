import { useCallback, useEffect, useMemo, useState } from "react";
import { inferFinalizacoesLegadas, listFinalizacoes } from "../services/finalizacoes.js";

export function useFinalizacoes({ logado, tombosNE = [], unidades = [] }) {
  const [finalizacoes, setFinalizacoes] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!logado) {
      setFinalizacoes([]);
      return [];
    }
    setLoading(true);
    try {
      const docs = await listFinalizacoes();
      setFinalizacoes(docs);
      return docs;
    } catch {
      setFinalizacoes([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [logado]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const listaCompleta = useMemo(() => {
    const knownUnitKeys = new Set(
      finalizacoes.flatMap((f) =>
        (f.unidadeNomes || []).map((n, i) => `${n}|${f.finalizedAt?.slice?.(0, 10) || ""}|${f.coordenadora?.nome || ""}`)
      )
    );
    const legadas = inferFinalizacoesLegadas(tombosNE, unidades).filter((leg) => {
      const k = `${leg.unidadeNomes[0]}|${String(leg.finalizedAt).slice(0, 10)}|${leg.coordenadora?.nome || ""}`;
      return !knownUnitKeys.has(k);
    });
    return [...finalizacoes, ...legadas].sort((a, b) => {
      const da = a.finalizedAt || "";
      const db = b.finalizedAt || "";
      if (da.includes("/") && db.includes("/")) return db.localeCompare(da);
      return String(db).localeCompare(String(da));
    });
  }, [finalizacoes, tombosNE, unidades]);

  return { finalizacoes: listaCompleta, loading, refresh };
}
