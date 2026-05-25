import { useCallback, useEffect, useRef, useState } from "react";
import { fsDel, fsGetAll, fsSet } from "../services/firebase.js";
import { getCachedData, setCachedData } from "../utils/performance.js";

export function useLocais() {
  const [locais, setLocais] = useState([]);
  const locaisRef = useRef([]);

  useEffect(() => {
    locaisRef.current = locais;
  }, [locais]);

  const loadLocais = useCallback(async () => {
    try {
      const cachedLocais = await getCachedData("locais");
      if (Array.isArray(cachedLocais) && cachedLocais.length > 0) setLocais(cachedLocais);

      const localDocs = await fsGetAll("locais");
      const nextLocais = localDocs.map((d) => ({ ...d, id: d._id }));
      setLocais(nextLocais);
      await setCachedData("locais", nextLocais);
      return nextLocais;
    } catch {
      return [];
    }
  }, []);

  const createLocal = useCallback(async ({ nome, desc }) => {
    const id = `loc_${Date.now()}`;
    const localData = { nome: String(nome || "").trim(), desc: desc || "" };
    await fsSet("locais", id, localData);
    const entry = { id, _id: id, ...localData };
    setLocais((prev) => [...prev, entry]);
    try {
      await setCachedData("locais", [...(locaisRef.current || []), entry]);
    } catch {}
    return entry;
  }, []);

  const deleteLocal = useCallback(async (l) => {
    const id = l?.id || l?._id;
    if (!id) return;
    await fsDel("locais", id);
    setLocais((prev) => prev.filter((x) => (x.id || x._id) !== id));
    try {
      const next = (locaisRef.current || []).filter((x) => (x.id || x._id) !== id);
      await setCachedData("locais", next);
    } catch {}
  }, []);

  return { locais, setLocais, locaisRef, loadLocais, createLocal, deleteLocal };
}

