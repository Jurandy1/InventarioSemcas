import { useCallback, useState } from "react";
import { loadUnidades } from "../utils/xlsx.js";

export function useUnidades({ showT } = {}) {
  const [unidades, setUnidades] = useState([]);
  const [loadingXlsx, setLoadingXlsx] = useState(false);

  const loadXlsx = useCallback(
    async (force = false) => {
      setLoadingXlsx(true);
      try {
        const unids = await loadUnidades(force);
        setUnidades(unids);
        return unids;
      } catch (e) {
        showT?.("⚠️ Erro ao carregar patrimônios: " + (e?.message || "Erro"));
        return [];
      } finally {
        setLoadingXlsx(false);
      }
    },
    [showT]
  );

  return { unidades, setUnidades, loadingXlsx, loadXlsx };
}

