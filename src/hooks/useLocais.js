import { useCallback, useEffect, useRef, useState } from "react";
import { fsDel, fsSet } from "../services/firebase.js";
import { fetchLocaisForUnits, mergeLocaisRecords } from "../services/locaisLoad.js";
import { bumpCacheBuster, getCachedData, setCachedData } from "../utils/performance.js";
import { offlineManager } from "../services/features.js";

export function useLocais() {
  const [locais, setLocais] = useState([]);
  const locaisRef = useRef([]);

  useEffect(() => {
    locaisRef.current = locais;
  }, [locais]);

  const loadLocais = useCallback(async (unitIds = [], options = {}) => {
    try {
      const cachedLocais = await getCachedData("locais");
      const memoryPrev = locaisRef.current || [];
      const basePrev =
        memoryPrev.length > 0
          ? memoryPrev
          : Array.isArray(cachedLocais) && cachedLocais.length > 0
            ? cachedLocais
            : [];
      if (memoryPrev.length === 0 && basePrev.length > 0) setLocais(basePrev);

      const ids = Array.isArray(unitIds) ? unitIds.filter(Boolean) : [];
      let incoming = [];
      if (!options.cacheOnly) {
        incoming = await fetchLocaisForUnits(ids, { localIds: options.localIds || [] });
      }

      const nextLocais = mergeLocaisRecords(basePrev, incoming);
      setLocais(nextLocais);
      await setCachedData("locais", nextLocais);
      return nextLocais;
    } catch {
      return locaisRef.current || [];
    }
  }, []);

  const createLocal = useCallback(async ({ nome, desc, sessionId, unidadeIds }, { updateQueueStatus } = {}) => {
    const id = `loc_${Date.now()}`;
    const unitList = Array.isArray(unidadeIds) ? unidadeIds.filter(Boolean) : [];
    const localData = {
      nome: String(nome || "").trim(),
      desc: desc || "",
      sessionId: sessionId || "",
      unidadeIds: unitList,
      unidadeId: unitList[0] || "",
      criadoEm: new Date().toISOString(),
    };
    const entry = { id, _id: id, ...localData };

    if (!navigator.onLine) {
      await offlineManager.queueOperation("save", {
        collection: "locais",
        docId: id,
        content: localData,
      });
      setLocais((prev) => [...prev, entry]);
      bumpCacheBuster();
      try {
        await setCachedData("locais", [...(locaisRef.current || []), entry]);
      } catch {}
      updateQueueStatus?.();
      return entry;
    }

    await fsSet("locais", id, localData);
    setLocais((prev) => [...prev, entry]);
    bumpCacheBuster();
    try {
      await setCachedData("locais", [...(locaisRef.current || []), entry]);
    } catch {}
    return entry;
  }, []);

  const deleteLocal = useCallback(async (l, { updateQueueStatus } = {}) => {
    const id = l?.id || l?._id;
    if (!id) return;

    if (!navigator.onLine) {
      await offlineManager.queueOperation("delete", { collection: "locais", docId: id });
      setLocais((prev) => prev.filter((x) => (x.id || x._id) !== id));
      bumpCacheBuster();
      try {
        const next = (locaisRef.current || []).filter((x) => (x.id || x._id) !== id);
        await setCachedData("locais", next);
      } catch {}
      updateQueueStatus?.();
      return;
    }

    await fsDel("locais", id);
    setLocais((prev) => prev.filter((x) => (x.id || x._id) !== id));
    bumpCacheBuster();
    try {
      const next = (locaisRef.current || []).filter((x) => (x.id || x._id) !== id);
      await setCachedData("locais", next);
    } catch {}
  }, []);

  return { locais, setLocais, locaisRef, loadLocais, createLocal, deleteLocal };
}
