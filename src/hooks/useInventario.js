import { useCallback, useEffect, useMemo, useState } from "react";
import { isItemInventariado } from "../utils/patrimonioId.js";
import {
  clearSessionId,
  createSessionId,
  getSessionId,
  loadSessoesPausadas,
  saveSessoesPausadas,
  setSessionId,
} from "../utils/inventorySession.js";

export function useInventario({ unidades, foundSet }) {
  const [unidadesAtivas, setUnidadesAtivas] = useState([]);
  const [pendingUnids, setPendingUnids] = useState(new Set());
  const [invSubTab, setInvSubTab] = useState("inventariar");
  const [sessionId, setSessionIdState] = useState(() => getSessionId());
  const [sessoesPausadas, setSessoesPausadas] = useState(() => loadSessoesPausadas());
  const [activeLocalId, setActiveLocalId] = useState("");

  useEffect(() => {
    try {
      const ativasRaw = localStorage.getItem("inv-ativas-ids");
      if (!ativasRaw || !Array.isArray(unidades) || unidades.length === 0) return;
      const ids = JSON.parse(ativasRaw);
      const restored = ids.map((id) => unidades.find((x) => x.id === id)).filter(Boolean);
      if (restored.length) {
        setUnidadesAtivas(restored);
        const sid = getSessionId();
        if (sid) setSessionIdState(sid);
      }
    } catch {}
  }, [unidades]);

  const persistSessoes = useCallback((list) => {
    setSessoesPausadas(list);
    saveSessoesPausadas(list);
  }, []);

  const clearAtivas = useCallback(() => {
    setUnidadesAtivas([]);
    setPendingUnids(new Set());
    clearSessionId();
    setSessionIdState("");
    try {
      localStorage.removeItem("inv-ativas-ids");
    } catch {}
  }, []);

  const arquivarSessaoAtual = useCallback(() => {
    if (unidadesAtivas.length === 0) return null;
    const sid = getSessionId() || sessionId;
    const entry = {
      id: `ps_${Date.now()}`,
      sessionId: sid,
      unitIds: unidadesAtivas.map((u) => u.id),
      unitNomes: unidadesAtivas.map((u) => u.nome),
      savedAt: new Date().toISOString(),
    };
    const next = [...loadSessoesPausadas(), entry];
    persistSessoes(next);
    clearAtivas();
    setInvSubTab("inventariar");
    return entry;
  }, [unidadesAtivas, sessionId, persistSessoes, clearAtivas]);

  const retomarSessaoPausada = useCallback(
    (entry) => {
      if (!entry?.unitIds?.length || !Array.isArray(unidades) || unidades.length === 0) return;
      const restored = entry.unitIds.map((id) => unidades.find((x) => x.id === id)).filter(Boolean);
      if (!restored.length) return;

      if (unidadesAtivas.length > 0) {
        const currentSid = getSessionId() || sessionId;
        const archived = {
          id: `ps_${Date.now()}`,
          sessionId: currentSid,
          unitIds: unidadesAtivas.map((u) => u.id),
          unitNomes: unidadesAtivas.map((u) => u.nome),
          savedAt: new Date().toISOString(),
        };
        persistSessoes([...loadSessoesPausadas().filter((s) => s.id !== entry.id), archived]);
      } else {
        persistSessoes(loadSessoesPausadas().filter((s) => s.id !== entry.id));
      }

      const sid = entry.sessionId || createSessionId();
      setSessionId(sid);
      setSessionIdState(sid);
      setUnidadesAtivas(restored);
      setPendingUnids(new Set());
      setInvSubTab("andamento");
      try {
        localStorage.setItem("inv-ativas-ids", JSON.stringify(entry.unitIds));
      } catch {}
    },
    [unidades, unidadesAtivas, sessionId, persistSessoes]
  );

  const confirmarAtivas = useCallback(
    (units, options = {}) => {
      const { merge = false, novaSessao = false } = options;

      if (merge && unidadesAtivas.length > 0) {
        setUnidadesAtivas((prev) => {
          const next = [...prev];
          for (const u of units) {
            if (!next.find((x) => x.id === u.id)) next.push(u);
          }
          try {
            localStorage.setItem("inv-ativas-ids", JSON.stringify(next.map((x) => x.id)));
          } catch {}
          return next;
        });
        setPendingUnids(new Set());
        setInvSubTab("andamento");
        return;
      }

      if (novaSessao && unidadesAtivas.length > 0) {
        arquivarSessaoAtual();
      }

      const sid = createSessionId();
      setSessionId(sid);
      setSessionIdState(sid);
      setUnidadesAtivas(units);
      setPendingUnids(new Set());
      setInvSubTab("andamento");
      try {
        localStorage.setItem("inv-ativas-ids", JSON.stringify(units.map((x) => x.id)));
      } catch {}
    },
    [unidadesAtivas.length, arquivarSessaoAtual]
  );

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

  const saveAtiva = useCallback(
    (u) => {
      if (u) addAtiva(u);
      else clearAtivas();
    },
    [addAtiva, clearAtivas]
  );

  const allItens = useMemo(
    () => unidadesAtivas.flatMap((u) => u.itens.map((i) => ({ ...i, unidadeNome: u.nome, unidadeId: u.id }))),
    [unidadesAtivas]
  );
  const totalBens = allItens.length;
  const totalFound = useMemo(() => allItens.filter((i) => isItemInventariado(i.id, foundSet)).length, [allItens, foundSet]);
  const progresso = totalBens > 0 ? Math.round((totalFound / totalBens) * 100) : 0;

  const pausedUnitIds = useMemo(() => {
    const ids = new Set();
    for (const s of sessoesPausadas) {
      for (const id of s.unitIds || []) ids.add(id);
    }
    return ids;
  }, [sessoesPausadas]);

  return {
    unidadesAtivas,
    setUnidadesAtivas,
    pendingUnids,
    setPendingUnids,
    invSubTab,
    setInvSubTab,
    sessionId,
    confirmarAtivas,
    addAtiva,
    removeAtiva,
    clearAtivas,
    saveAtiva,
    arquivarSessaoAtual,
    retomarSessaoPausada,
    sessoesPausadas,
    pausedUnitIds,
    activeLocalId,
    setActiveLocalId,
    allItens,
    totalBens,
    totalFound,
    progresso,
  };
}
