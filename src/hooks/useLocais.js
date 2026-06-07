import { useCallback, useEffect, useRef, useState } from "react";
import { fsDel, fsGetAll, fsSet } from "../services/firebase.js";
import { bumpCacheBuster, getCachedData, setCachedData } from "../utils/performance.js";
import { offlineManager } from "../services/features.js";
export function useLocais() {
  const [locais, setLocais] = useState([]);
  const locaisRef = useRef([]);

  useEffect(() => {
    locaisRef.current = locais;
  }, [locais]);

  const loadLocais = useCallback(async (unitIds = []) => {
    try {
      const cachedLocais = await getCachedData("locais");
      if (Array.isArray(cachedLocais) && cachedLocais.length > 0) setLocais(cachedLocais);

      const ids = Array.isArray(unitIds) ? unitIds.filter(Boolean) : [];
      let localDocs = [];
      if (ids.length === 1) {
        localDocs = await fsGetAll("locais", {
          where: [{ field: "unidadeIds", op: "ARRAY_CONTAINS", value: ids[0] }],
          pageSize: 150,
        });
      } else if (ids.length > 1) {
        const chunks = await Promise.all(
          ids.map((uid) =>
            fsGetAll("locais", {
              where: [{ field: "unidadeIds", op: "ARRAY_CONTAINS", value: uid }],
              pageSize: 150,
            })
          )
        );
        const seen = new Set();
        for (const chunk of chunks) {
          for (const d of chunk) {
            const lid = d._id || d.id;
            if (seen.has(lid)) continue;
            seen.add(lid);
            localDocs.push(d);
          }
        }
      } else {
        localDocs = await fsGetAll("locais", { pageSize: 150 });
      }

      const nextLocais = localDocs.map((d) => ({ ...d, id: d._id }));
      setLocais(nextLocais);
      await setCachedData("locais", nextLocais);
      return nextLocais;
    } catch {
      return [];
    }
  }, []);
  const createLocal = useCallback(async ({ nome, desc, sessionId, unidadeIds }, { updateQueueStatus } = {}) => {
    const id = `loc_${Date.now()}`;
    const localData = {
      nome: String(nome || "").trim(),
      desc: desc || "",
      sessionId: sessionId || "",
      unidadeIds: Array.isArray(unidadeIds) ? unidadeIds : [],
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

