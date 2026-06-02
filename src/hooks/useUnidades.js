import { useCallback, useState } from "react";
import { loadUnidades } from "../utils/xlsx.js";
import { fsGetAll } from "../services/firebase.js";

export function useUnidades({ showT } = {}) {
  const [unidades, setUnidades] = useState([]);
  const [loadingXlsx, setLoadingXlsx] = useState(false);

  const loadXlsx = useCallback(
    async (force = false) => {
      setLoadingXlsx(true);
      try {
        const unids = await loadUnidades(force);

        try {
          const manuais = await fsGetAll("manuais");
          if (Array.isArray(manuais) && manuais.length > 0) {
            const byUnit = new Map();
            for (const m of manuais) {
              const unidadeId = m.unidadeId;
              if (!unidadeId) continue;
              if (!byUnit.has(unidadeId)) byUnit.set(unidadeId, []);
              byUnit.get(unidadeId).push({
                id: m._id || m.id,
                patrimonioLabel: m.patrimonioLabel ?? null,
                data: m.data || "",
                especie: m.especie || "",
                descricao: m.descricao || "",
                marca: m.marca || "",
                fornecedor: m.fornecedor || "",
                empenho: m.empenho || "",
                nf: m.nf || "",
                dataNF: m.dataNF || "",
                tipoEntrada: m.tipoEntrada || "Próprio",
                valor: Number(m.valor || 0) || 0,
                valorAtual: Number(m.valorAtual || 0) || 0,
                isManual: true,
              });
            }
            for (const u of unids) {
              const extras = byUnit.get(u.id);
              if (!extras?.length) continue;
              const existingIds = new Set((u.itens || []).map((i) => i.id));
              for (const e of extras) {
                if (!existingIds.has(e.id)) u.itens.push(e);
              }
            }
          }
        } catch {}

        setUnidades(unids);
        return unids;
      } catch (e) {
        showT?.("Erro ao carregar patrimônios: " + (e?.message || "Erro"));
        return [];
      } finally {
        setLoadingXlsx(false);
      }
    },
    [showT]
  );

  return { unidades, setUnidades, loadingXlsx, loadXlsx };
}

