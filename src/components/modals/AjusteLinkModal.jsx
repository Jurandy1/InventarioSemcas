import React from "react";
import { Overlay } from "../Overlay.jsx";
import { TInput } from "../FormFields.jsx";

export function AjusteLinkModal({
  isMob,
  setModal,
  formRef,
  getField,
  setField,
  bumpFt,
  scopeAllItens,
  isSemTomboItem,
  found,
  rankTombosForAjuste,
  linkSemTomboToTombo,
  bs,
  bp,
  inp,
  ft,
}) {
  const srcItem = formRef.current.ajusteStItem;
  const isReassign = !!srcItem && !srcItem.isManual && !/^(ST_|MAN_)/i.test(String(srcItem.id || ""));
  return (
    <Overlay isMobile={isMob} onClose={() => setModal(null)}>
      <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700 }}>
        {isReassign ? "Mover registro para outro tombo" : "Vincular foto ao tombo"}
      </h2>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>
        {isReassign ? (
          <>
            Registro atual: <strong>Nº {srcItem.patrimonioLabel || srcItem.id}</strong> ·{" "}
            {formRef.current.ajusteStFound?.descricaoEdit || srcItem.descricao || "—"}
          </>
        ) : (
          <>
            Foto/descrição: <strong>{srcItem?.descricao || formRef.current.ajusteStFound?.descricaoEdit || "—"}</strong>
          </>
        )}
      </p>
      <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: 10, marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 11, color: "#92400e" }}>
          {isReassign
            ? `Escolha o tombo correto (ainda não inventariado). O registro — fotos, local, estado — será transferido e o tombo ${srcItem.patrimonioLabel || srcItem.id} voltará a ficar pendente.`
            : "Escolha um tombo da planilha que ainda não foi inventariado. A foto será transferida para esse patrimônio."}
        </p>
      </div>
      <TInput
        key={"ajS_" + ft}
        initial={getField("ajusteSearch")}
        onVal={(v) => {
          setField("ajusteSearch", v);
          bumpFt();
        }}
        placeholder="Buscar tombo pendente..."
        style={{ ...inp, marginBottom: 8 }}
      />
      <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 10 }}>
        {(() => {
          const stUnitId = formRef.current.ajusteStItem?.unidadeId || formRef.current.ajusteStFound?.unidadeId;
          const q = String(formRef.current.ajusteSearch || "").trim().toLowerCase();
          const pool = scopeAllItens.filter((i) => {
            if (i.id === formRef.current.ajusteStId) return false;
            if (isSemTomboItem(i, found.foundMap[i.id])) return false;
            if (String(i.id || "").startsWith("ST_") || String(i.id || "").startsWith("MAN_")) return false;
            if (found.foundSet.has(i.id)) return false;
            if (stUnitId && i.unidadeId && i.unidadeId !== stUnitId) return false;
            if (!q) return true;
            return (
              String(i.id || "").toLowerCase().includes(q) ||
              String(i.patrimonioLabel || "").toLowerCase().includes(q) ||
              String(i.descricao || "").toLowerCase().includes(q) ||
              String(i.especie || "").toLowerCase().includes(q) ||
              String(i.fornecedor || "").toLowerCase().includes(q) ||
              String(i.marca || "").toLowerCase().includes(q)
            );
          });
          const ranked = rankTombosForAjuste(formRef.current.ajusteStItem, formRef.current.ajusteStFound, pool, {
            minScore: 0,
            limit: 50,
          });
          const rankedIds = new Set(ranked.map((r) => r.item.id));
          const rest = pool.filter((i) => !rankedIds.has(i.id));
          const candidates = [...ranked.map((r) => ({ ...r.item, _match: r })), ...rest.map((item) => ({ ...item, _match: null }))].slice(0, 40);
          if (!candidates.length) {
            return <p style={{ margin: 0, padding: 16, fontSize: 12, color: "#94a3b8", textAlign: "center" }}>Nenhum tombo pendente encontrado.</p>;
          }
          return candidates.map((it) => {
            const sel = formRef.current.ajusteRealId === it.id;
            const match = it._match;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => {
                  formRef.current.ajusteRealId = it.id;
                  bumpFt();
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  borderBottom: "1px solid #f1f5f9",
                  background: sel ? "#eff6ff" : match?.score >= 40 ? "#f0fdf4" : "#fff",
                  padding: "10px 12px",
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ display: "block", fontSize: 12, fontWeight: 700, flex: 1 }}>{it.descricao || it.especie || "—"}</span>
                  {match?.score >= 15 && (
                    <span style={{ fontSize: 10, fontWeight: 800, color: match.score >= 60 ? "#15803d" : "#1d4ed8", flexShrink: 0 }}>
                      {match.score}% · {match.reasons?.join(", ")}
                    </span>
                  )}
                </span>
                <span style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  Nº {it.patrimonioLabel || it.id} · {it.fornecedor || "—"}
                  {it.marca ? ` · Marca: ${it.marca}` : ""}
                </span>
              </button>
            );
          });
        })()}
      </div>
      <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
        <button onClick={() => setModal(null)} style={{ ...bs, flex: 1 }}>Cancelar</button>
        <button onClick={linkSemTomboToTombo} style={{ ...bp, flex: 1 }}>{isReassign ? "Mover registro" : "Vincular"}</button>
      </div>
    </Overlay>
  );
}
