import { useCallback, useEffect, useMemo, useState } from "react";
import { inferFinalizacoesLegadas, listFinalizacoes } from "../services/finalizacoes.js";

export function useFinalizacoes({ logado, tombosNE = [], unidades = [] }) {
  const [finalizacoes, setFinalizacoes] = useState([]);
  const [loading, setLoading] = useState(false);

  const uid = logado?.uid || "";
  const refresh = useCallback(async () => {
    if (!uid) {
      setFinalizacoes([]);
      return [];
    }
    setLoading(true);
    try {
      const docs = await listFinalizacoes();
      // Dedup only true duplicates: same sessionId AND same set of units
      // (guards against double-click on Finalizar). Don't dedup by unitIds
      // alone — that hides legitimate re-finalizations of the same unit.
      const deduped = [];
      const seenKeys = new Set();
      for (const d of docs) {
        const unitKey = [...(d.unidadeIds || [])].sort().join(",");
        const key = d.sessionId ? `${d.sessionId}|${unitKey}` : "";
        if (key && seenKeys.has(key)) continue;
        if (key) seenKeys.add(key);
        deduped.push(d);
      }
      setFinalizacoes(deduped);
      return deduped;
    } catch (e) {
      console.warn("useFinalizacoes.refresh falhou:", e?.message || e);
      setFinalizacoes([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const listaCompleta = useMemo(() => {
    // Create a set of known unit IDs to avoid duplicates with legacy
    const knownUnitIds = new Set();
    for (const f of finalizacoes) {
      (f.unidadeIds || []).forEach(id => knownUnitIds.add(id));
    }
    
    const knownUnitKeys = new Set(
      finalizacoes.flatMap((f) =>
        (f.unidadeNomes || []).map((n, i) => `${n}|${f.finalizedAt?.slice?.(0, 10) || ""}|${f.coordenadora?.nome || ""}`)
      )
    );
    const legadas = inferFinalizacoesLegadas(tombosNE, unidades).filter((leg) => {
      // Don't show legacy if we already have a finalization for that unit ID
      const hasMatchingUnitId = (leg.unidadeIds || []).some(id => knownUnitIds.has(id));
      if (hasMatchingUnitId) return false;
      
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
