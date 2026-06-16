import { useCallback, useEffect, useState } from "react";
import { fecharCampanha, isCampanhaFechada, loadCampanhaAtiva, reabrirCampanha } from "../services/campanha.js";

export function useCampanha({ logado } = {}) {
  const [campanha, setCampanha] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const c = await loadCampanhaAtiva();
      setCampanha(c);
      return c;
    } catch {
      setCampanha({ status: "aberta", nome: "Inventário atual" });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const uid = logado?.uid || "";
  useEffect(() => {
    if (!uid) {
      setCampanha(null);
      setLoading(false);
      return;
    }
    refresh();
  }, [uid, refresh]);

  const fechada = isCampanhaFechada(campanha);

  const fechar = useCallback(async () => {
    await fecharCampanha(logado?.email || logado?.nome || "");
    await refresh();
  }, [logado, refresh]);

  const reabrir = useCallback(async () => {
    await reabrirCampanha(logado?.email || logado?.nome || "");
    await refresh();
  }, [logado, refresh]);

  return { campanha, loading, fechada, refresh, fechar, reabrir };
}
