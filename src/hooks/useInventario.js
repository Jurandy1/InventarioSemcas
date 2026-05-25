import { useCallback, useEffect, useMemo, useState } from "react";

export function useInventario({ unidades, foundSet }) {
  const [unidadesAtivas, setUnidadesAtivas] = useState([]);
  const [pendingUnids, setPendingUnids] = useState(new Set());
  const [invSubTab, setInvSubTab] = useState("inventariar");

  useEffect(() => {
    try {
      const ativasRaw = localStorage.getItem("inv-ativas-ids");
      if (!ativasRaw || !Array.isArray(unidades) || unidades.length === 0) return;
      const ids = JSON.parse(ativasRaw);
      const restored = ids.map((id) => unidades.find((x) => x.id === id)).filter(Boolean);
      if (restored.length) setUnidadesAtivas(restored);
    } catch {}
  }, [unidades]);

  const confirmarAtivas = useCallback((units) => {
    setUnidadesAtivas(units);
    setPendingUnids(new Set());
    setInvSubTab("andamento");
    try {
      localStorage.setItem("inv-ativas-ids", JSON.stringify(units.map((x) => x.id)));
    } catch {}
  }, []);

  const addAtiva = useCallback((u) => {
    if (!u) return;
    setUnidadesAtivas((prev) => {
      const next = prev.find((x) => x.id === u.id) ? prev : [...prev, u];
      try {
        localStorage.setItem("inv-ativas-ids", JSON.stringify(next.map((x) => x.id)));
      } catch {}
      return next;
    });
  }, []);

  const removeAtiva = useCallback((uid) => {
    setUnidadesAtivas((prev) => {
      const next = prev.filter((u) => u.id !== uid);
      try {
        localStorage.setItem("inv-ativas-ids", JSON.stringify(next.map((x) => x.id)));
      } catch {}
      return next;
    });
  }, []);

  const clearAtivas = useCallback(() => {
    setUnidadesAtivas([]);
    setPendingUnids(new Set());
    try {
      localStorage.removeItem("inv-ativas-ids");
    } catch {}
  }, []);

  const saveAtiva = useCallback(
    (u) => {
      if (u) addAtiva(u);
      else clearAtivas();
    },
    [addAtiva, clearAtivas]
  );

  const allItens = useMemo(() => unidadesAtivas.flatMap((u) => u.itens.map((i) => ({ ...i, unidadeNome: u.nome, unidadeId: u.id }))), [unidadesAtivas]);
  const totalBens = allItens.length;
  const totalFound = useMemo(() => allItens.filter((i) => foundSet?.has(i.id)).length, [allItens, foundSet]);
  const progresso = totalBens > 0 ? Math.round((totalFound / totalBens) * 100) : 0;

  return {
    unidadesAtivas,
    setUnidadesAtivas,
    pendingUnids,
    setPendingUnids,
    invSubTab,
    setInvSubTab,
    confirmarAtivas,
    addAtiva,
    removeAtiva,
    clearAtivas,
    saveAtiva,
    allItens,
    totalBens,
    totalFound,
    progresso,
  };
}

