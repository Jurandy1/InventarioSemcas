import React, { useEffect, useRef } from "react";
import { setupRealtimeSync } from "../../services/audit.js";
import { offlineManager } from "../../services/features.js";
import { normalizeFoundRecord } from "../../services/inventarioLoad.js";
import { mergeFoundRecords } from "../../utils/inventorySession.js";
import { mergeLocaisRecords } from "../../services/locaisLoad.js";
import { setCachedData } from "../../utils/performance.js";
import { clearInventoryPresence, loadActiveInventors, pingInventoryPresence } from "../../utils/inventoryPresence.js";
import { createVisibilityAwarePoller, getSyncIntervals, getPresencePollMs } from "../../utils/mobilePerf.js";

const ACTIVE_TABS = new Set(["inventario", "finalizados", "busca"]);

export function useAppSync({ state, data }) {
  const {
    modal, isMob, tab, setTeamOnline, editingItemRef,
  } = state;
  const {
    auth, inventario, unidades, found, locais, updateQueueStatus,
    queueStatus, showT, activeUnitIds, unidadeAtiva,
  } = data;

  const presenceMs = getPresencePollMs(isMob);
  const lowPriority = !ACTIVE_TABS.has(tab);

  useEffect(() => {
    if (!modal) return;
    const scrollY = window.scrollY || 0;
    const prev = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = prev.overflow;
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [modal]);

  useEffect(() => {
    if (!auth.logado?.uid || inventario.unidadesAtivas.length === 0 || inventario.invSubTab !== "andamento") {
      setTeamOnline([]);
      return;
    }

    const unitIds = activeUnitIds;
    const ping = () => {
      const item = editingItemRef.current;
      pingInventoryPresence({
        uid: auth.logado.uid,
        nome: auth.logado.nome,
        email: auth.logado.email,
        unidadeIds: unitIds,
        itemEmEdicao: item?.id || null,
        itemDescricao: item ? String(item.descricao || item.especie || item.id || "").trim() : "",
      }).catch(() => {});
    };

    const stopPing = createVisibilityAwarePoller(ping, {
      activeMs: presenceMs.activeMs,
      hiddenMs: presenceMs.hiddenMs,
      runImmediately: true,
    });
    const stopTeam = createVisibilityAwarePoller(
      async () => {
        try {
          const others = await loadActiveInventors(unitIds, { excludeUid: auth.logado.uid });
          setTeamOnline(others);
        } catch {}
      },
      { activeMs: presenceMs.teamActiveMs, hiddenMs: presenceMs.teamHiddenMs, runImmediately: true }
    );

    return () => {
      stopPing();
      stopTeam();
      clearInventoryPresence(auth.logado.uid).catch(() => {});
    };
  }, [auth.logado?.uid, auth.logado?.nome, auth.logado?.email, activeUnitIds.join(","), inventario.invSubTab]);

  // Refs para que o poller leia sempre o estado mais recente sem reiniciar
  // toda vez que items/unidades mudam (do contrário cada item adicionado
  // restartaria o sync, gerando uma cascata de network requests).
  const syncContextRef = useRef({
    unidadesAtivas: inventario.unidadesAtivas,
    allItens: inventario.allItens,
    unidades,
    updateQueueStatus,
  });
  useEffect(() => {
    syncContextRef.current = {
      unidadesAtivas: inventario.unidadesAtivas,
      allItens: inventario.allItens,
      unidades,
      updateQueueStatus,
    };
  });

  useEffect(() => {
    if (!auth.logado?.uid) return;
    const paused = inventario.invSubTab === "inventariar" && inventario.unidadesAtivas.length > 0;
    if (!paused) syncContextRef.current.updateQueueStatus?.();

    const onInventarioChange = async (docs) => {
      const ctx = syncContextRef.current;
      const incoming = docs.map((d) => normalizeFoundRecord({ ...d, patrimonioId: d.patrimonioId || d._id }));
      const prev = found.foundRef.current || [];
      const scopeItems =
        ctx.unidadesAtivas.length > 0
          ? ctx.allItens
          : ctx.unidades.flatMap((u) => u.itens.map((i) => ({ ...i, unidadeId: u.id, unidadeNome: u.nome })));
      const nextFound = mergeFoundRecords(prev, incoming, {
        keepItemIds: scopeItems.map((i) => i.id),
        itemUnits: new Map(scopeItems.map((i) => [i.id, { unidadeId: i.unidadeId, unidadeNome: i.unidadeNome }])),
      });
      let same = prev.length === nextFound.length;
      if (same) {
        const prevMap = new Map(prev.map((p) => [p.patrimonioId || p._id, `${p.ultimaAtualizacao || ""}|${(p.fotoUrls || []).length}`]));
        same = prevMap.size === nextFound.length;
        if (same) {
          for (const n of nextFound) {
            const id = n.patrimonioId || n._id;
            const sig = `${n.ultimaAtualizacao || ""}|${(n.fotoUrls || []).length}`;
            if (prevMap.get(id) !== sig) {
              same = false;
              break;
            }
          }
        }
      }
      if (!same) {
        found.foundRef.current = nextFound;
        found.setFound(nextFound);
        await setCachedData("inventario", nextFound);
      }
    };

    const onLocaisChange = paused
      ? null
      : async (docs) => {
        const incoming = docs.map((d) => ({ ...d, id: d._id || d.id }));
        const prev = locais.locaisRef.current || [];
        const nextLocais = mergeLocaisRecords(prev, incoming);
        let same = prev.length === nextLocais.length;
        if (same) {
          const prevMap = new Map(prev.map((p) => [p.id || p._id, String(p.nome || "")]));
          for (const n of nextLocais) {
            const id = n.id || n._id;
            if (prevMap.get(id) !== String(n.nome || "")) {
              same = false;
              break;
            }
          }
        }
        if (!same) {
          locais.setLocais(nextLocais);
          await setCachedData("locais", nextLocais);
        }
      };

    const syncMs = getSyncIntervals({ paused, isMobile: isMob, lowPriority });
    const unsub = setupRealtimeSync(
      activeUnitIds.length ? activeUnitIds : unidadeAtiva?.id,
      onInventarioChange,
      onLocaisChange,
      null,
      syncMs
    );

    return () => {
      unsub?.();
    };
  }, [
    auth.logado?.uid,
    activeUnitIds.join(","),
    unidadeAtiva?.id,
    inventario.invSubTab,
    isMob,
    tab,
    found.setFound,
    found.foundRef,
    locais.setLocais,
    locais.locaisRef,
  ]);

  const renderOfflineStatus = () => {
    const retry = async (e) => {
      e?.stopPropagation?.();
      await offlineManager.retrySync();
      updateQueueStatus();
      showT("Sincronização iniciada");
    };

    if (queueStatus.isOnline && queueStatus.pending === 0 && queueStatus.failed === 0) {
      return <span style={{ fontSize: 11, color: "#C6E0FF", fontWeight: 700 }}>● Online</span>;
    }

    const btnStyle = {
      marginLeft: 8,
      background: "rgba(255,255,255,.2)",
      color: "#fff",
      border: "none",
      borderRadius: 6,
      padding: "2px 8px",
      fontSize: 11,
      fontWeight: 700,
      cursor: "pointer",
    };

    if (!queueStatus.isOnline) {
      return (
        <span style={{ fontSize: 11, color: "#FFF8E6", fontWeight: 700 }}>
          Offline · {queueStatus.pending} pendente{queueStatus.pending !== 1 ? "s" : ""}
          {queueStatus.photoPending ? ` · ${queueStatus.photoPending} c/ fotos` : ""}
        </span>
      );
    }

    return (
      <span style={{ fontSize: 11, color: "#FFF8E6", fontWeight: 700, display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
        {queueStatus.isSyncing ? "Sincronizando" : "Fila"} · {queueStatus.pending} pendente{queueStatus.pending !== 1 ? "s" : ""}
        {queueStatus.photoPending ? ` · ${queueStatus.photoPending} c/ fotos` : ""}
        {queueStatus.failed ? ` · ${queueStatus.failed} falha(s)` : ""}
        {(queueStatus.pending > 0 || queueStatus.failed > 0) && !queueStatus.isSyncing ? (
          <button type="button" onClick={retry} style={btnStyle}>
            Tentar novamente
          </button>
        ) : null}
      </span>
    );
  };

  return { renderOfflineStatus };
}
