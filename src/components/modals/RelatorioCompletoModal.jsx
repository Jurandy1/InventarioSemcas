import React, { useEffect, useMemo, useState } from "react";
import { Overlay } from "../Overlay.jsx";
import {
  buildRelatorioCompletoRows,
  enrichRelatorioCompletoRowsWithLocais,
  gerarRelatorioCompletoExcel,
  gerarRelatorioCompletoPDF,
  listUnidadesFinalizadas,
} from "../../services/features.js";

const FORMATOS = [
  { key: "excel", label: "Excel (sem foto)" },
  { key: "pdf", label: "PDF (sem foto)" },
  { key: "pdf_foto", label: "PDF (com foto)" },
];

export function RelatorioCompletoModal({
  isMob,
  onClose,
  todosItens,
  foundMap,
  finalizacoes = [],
  unidades = [],
  locais = [],
  bp,
  bs,
  showT,
  onExported,
}) {
  const [unidadeId, setUnidadeId] = useState("todas");
  const [formato, setFormato] = useState("excel");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);

  const unidadesOpts = useMemo(() => listUnidadesFinalizadas(finalizacoes, unidades), [finalizacoes, unidades]);

  const rows = useMemo(
    () =>
      buildRelatorioCompletoRows({
        todosItens,
        foundMap,
        finalizacoes,
        unidadeId: unidadeId === "todas" ? null : unidadeId,
      }),
    [todosItens, foundMap, finalizacoes, unidadeId]
  );

  const [rowsPreview, setRowsPreview] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const enriched = await enrichRelatorioCompletoRowsWithLocais(rows, locais);
      if (!cancelled) setRowsPreview(enriched);
    })();
    return () => {
      cancelled = true;
    };
  }, [rows, locais]);

  const tituloUnidades = useMemo(() => {
    if (unidadeId === "todas") return "Todas as unidades finalizadas";
    const u = unidadesOpts.find((x) => x.id === unidadeId);
    return u?.nome || u?.label || unidadeId;
  }, [unidadeId, unidadesOpts]);

  const previewRows = rowsPreview.slice(0, 10);
  const pct = progress?.total ? Math.round((progress.done / progress.total) * 100) : 0;

  const gerar = async () => {
    if (!finalizacoes?.length) {
      showT?.("Nenhuma unidade finalizada para exportar");
      return;
    }
    if (rows.length === 0) {
      showT?.("Nenhum item inventariado nas unidades selecionadas");
      return;
    }

    setBusy(true);
    setProgress({ done: 0, total: 1, label: "Preparando…" });
    const stamp = new Date().toISOString().slice(0, 10);
    const slug = unidadeId === "todas" ? "todas" : String(unidadeId).replace(/\W+/g, "_").slice(0, 24);

    try {
      if (formato === "excel") {
        const { workbook, XLSX } = await gerarRelatorioCompletoExcel(rows, { tituloUnidades, locais });
        XLSX.writeFile(workbook, `relatorio_completo_${slug}_${stamp}.xlsx`);
      } else {
        const doc = await gerarRelatorioCompletoPDF(rows, {
          comFoto: formato === "pdf_foto",
          tituloUnidades,
          locais,
          onProgress: setProgress,
        });
        const suffix = formato === "pdf_foto" ? "com_fotos" : "sem_fotos";
        doc.save(`relatorio_completo_${slug}_${suffix}_${stamp}.pdf`);
      }
      await onExported?.({ formato, unidadeId, count: rows.length });
      showT?.("Relatório gerado");
      onClose?.();
    } catch (e) {
      showT?.(e?.message || "Erro ao gerar relatório");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Overlay isMobile={isMob} onClose={busy ? undefined : onClose}>
      <div>
        <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700 }}>Relatório completo</h2>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#64748b", lineHeight: 1.45 }}>
          Exporta itens <strong>inventariados</strong> das unidades finalizadas: unidade, tombo, local, descrição, NF, valor e estado.
        </p>

        <label style={{ display: "block", marginBottom: 12 }}>
          <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Unidade</span>
          <select
            value={unidadeId}
            disabled={busy || !unidadesOpts.length}
            onChange={(e) => setUnidadeId(e.target.value)}
            style={{
              width: "100%",
              border: "1.5px solid #e2e8f0",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <option value="todas">Todas as unidades finalizadas</option>
            {unidadesOpts.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset style={{ border: "none", margin: "0 0 12px", padding: 0 }}>
          <legend style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Formato</legend>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {FORMATOS.map((f) => (
              <label
                key={f.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: `1.5px solid ${formato === f.key ? "#93c5fd" : "#e2e8f0"}`,
                  background: formato === f.key ? "#eff6ff" : "#fff",
                  cursor: busy ? "default" : "pointer",
                }}
              >
                <input type="radio" name="formato" value={f.key} checked={formato === f.key} disabled={busy} onChange={() => setFormato(f.key)} />
                <span style={{ fontSize: 13, fontWeight: formato === f.key ? 700 : 500 }}>{f.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <p style={{ margin: "0 0 10px", fontSize: 12, color: "#475569" }}>
          <strong>{rows.length}</strong> item(ns) no relatório
        </p>

        {previewRows.length > 0 && (
          <div
            style={{
              maxHeight: 160,
              overflowY: "auto",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: 8,
              marginBottom: 12,
              background: "#f8fafc",
              fontSize: 11,
            }}
          >
            <p style={{ margin: "0 0 6px", fontWeight: 700, color: "#64748b" }}>Prévia (primeiros {previewRows.length})</p>
            {previewRows.map((r) => (
              <p key={`${r.unidadeId}_${r.itemId}`} style={{ margin: "0 0 4px", color: "#334155" }}>
                {r.unidade} · {r.tombo} · {r.local || "Sem local"} · {String(r.descricao).slice(0, 40)} · R$ {r.valorFmt} · {r.estado}
              </p>
            ))}
            {rows.length > previewRows.length && (
              <p style={{ margin: "4px 0 0", color: "#94a3b8" }}>+ {rows.length - previewRows.length} item(ns)</p>
            )}
          </div>
        )}

        {busy && progress && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ height: 8, background: "#e2e8f0", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "#1351B4", transition: "width .2s" }} />
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "#64748b" }}>
              Gerando… {progress.done}/{progress.total}
              {progress.label ? ` · ${progress.label}` : ""}
            </p>
          </div>
        )}

        <div style={{ display: "flex", gap: 9 }}>
          <button type="button" onClick={onClose} disabled={busy} style={{ ...bs, flex: 1 }}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={gerar}
            disabled={busy || rows.length === 0 || !finalizacoes?.length}
            style={{
              ...bp,
              flex: 1.2,
              opacity: busy || rows.length === 0 || !finalizacoes?.length ? 0.55 : 1,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy ? "Gerando…" : "Gerar relatório"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
