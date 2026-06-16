import React from "react";
import { Overlay } from "../Overlay.jsx";
import { TInput, TArea } from "../FormFields.jsx";
import { DoacaoOrigemFields } from "../DoacaoOrigemFields.jsx";

export function SemTomboModal({
  isMob,
  revokeBlobUrls,
  formRef,
  setModal,
  bumpFt,
  getField,
  setField,
  sessionLocais,
  openCamera,
  inventario,
  sugestoes,
  getSemTomboPendentes,
  toggleStPending,
  getItemCode,
  addSemTomboPendentes,
  addSemTomboItem,
  bs,
  bp,
  inp,
  ft,
}) {
  return (
    <Overlay isMobile={isMob} onClose={() => { revokeBlobUrls(formRef.current.stPhotos || []); setModal(null); }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700 }}>
        {(formRef.current.stMode || "novo") === "pendentes" ? "Mesma foto em vários tombos" : "Foto e descrição (sem tombo)"}
      </h2>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>
        {(formRef.current.stMode || "novo") === "pendentes"
          ? "Tire uma foto e marque vários itens pendentes da planilha com ela."
          : "Registre o que encontrou por foto. Depois vincule ao tombo correto na aba Ajuste."}
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[
          { id: "novo", label: "Novo sem tombo" },
          { id: "pendentes", label: "Marcar pendentes" },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => {
              formRef.current.stMode = m.id;
              bumpFt();
            }}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: 9,
              border: `2px solid ${(formRef.current.stMode || "novo") === m.id ? "#1351B4" : "#e2e8f0"}`,
              background: (formRef.current.stMode || "novo") === m.id ? "#dbeafe" : "#fff",
              color: (formRef.current.stMode || "novo") === m.id ? "#1351B4" : "#64748b",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Local da sessão *</label>
      <select key={"stLoc_" + ft} defaultValue={getField("stLocal")} onChange={(e) => setField("stLocal", e.target.value)} style={inp}>
        <option value="">— Selecione —</option>
        {sessionLocais.map((l) => (
          <option key={l.id} value={l.id}>
            {l.nome}
          </option>
        ))}
      </select>
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 12 }}>Fotos *</label>
      {formRef.current.stPhotos?.length > 0 ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {formRef.current.stPhotos.map((ph, i) => (
            <img key={i} src={ph} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", border: "1px solid #e2e8f0" }} />
          ))}
        </div>
      ) : null}
      <button onClick={() => openCamera("semTombo")} style={{ width: "100%", border: "1.5px dashed #cbd5e1", background: "#f8fafc", borderRadius: 8, padding: 12, cursor: "pointer", fontSize: 13, color: "#334155", fontWeight: 600, marginBottom: 12 }}>
        {formRef.current.stPhotos?.length ? "Tirar outra foto" : "Tirar foto"}
      </button>

      {(formRef.current.stMode || "novo") === "novo" ? (
        <>
          <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: 10, marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#92400e", fontWeight: 600 }}>Será marcado como item sem tombo (identificado por foto).</p>
          </div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Nome / descrição do item *</label>
          <TArea key={"stDesc_" + ft} initial={getField("stDesc")} onVal={(v) => setField("stDesc", v)} rows={2} placeholder="Ex: Cadeira giratória preta..." style={{ ...inp, resize: "none" }} />
          {inventario.unidadesAtivas.length > 1 && (
            <>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 12 }}>Unidade</label>
              <select key={"stUn_" + ft} defaultValue={getField("stUnidadeId")} onChange={(e) => setField("stUnidadeId", e.target.value)} style={inp}>
                {inventario.unidadesAtivas.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </>
          )}
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 12 }}>Marca / fornecedor da mobília</label>
          <TInput key={"stMarca_" + ft} initial={getField("stMarca")} onVal={(v) => setField("stMarca", v)} placeholder="Ex: RM MOVEIS" style={inp} />
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 12 }}>Origem</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            {["Próprio", "Doação"].map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => {
                  setField("stOrigem", o);
                  bumpFt();
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 9,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: `2px solid ${(getField("stOrigem") || "Próprio") === o ? "#1351B4" : "#e2e8f0"}`,
                  background: (getField("stOrigem") || "Próprio") === o ? "#dbeafe" : "#fff",
                  color: (getField("stOrigem") || "Próprio") === o ? "#1351B4" : "#6b7280",
                  minHeight: 44,
                }}
              >
                {o}
              </button>
            ))}
          </div>
          {(getField("stOrigem") || "Próprio") === "Doação" && (
            <DoacaoOrigemFields prefix="st" getField={getField} setField={setField} bumpFt={bumpFt} inp={inp} ft={ft} />
          )}
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 12 }}>Tombamento sugerido (opcional)</label>
          <TInput key={"stRef_" + ft} initial={getField("stTomboRef")} onVal={(v) => setField("stTomboRef", v)} placeholder="Número se souber..." style={inp} />
        </>
      ) : (
        <>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b" }}>Busque itens pendentes e selecione vários para usar a mesma foto.</p>
          <TInput
            key={"stPendS_" + ft}
            initial={getField("stPendSearch")}
            onVal={(v) => {
              setField("stPendSearch", v);
              bumpFt();
            }}
            placeholder="Buscar por tombo, descrição, fornecedor..."
            style={{ ...inp, marginBottom: 8 }}
          />
          <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 10, padding: 8, marginBottom: 8 }}>
            {getSemTomboPendentes().slice(0, 40).map((it) => {
              const sel = (formRef.current.stSelectedIds || []).includes(it.id);
              return (
                <label key={it.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 6px", borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}>
                  <input type="checkbox" checked={sel} onChange={() => toggleStPending(it.id)} style={{ marginTop: 3 }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 12, fontWeight: 700 }}>{it.descricao || it.especie || "—"}</span>
                    <span style={{ display: "block", fontSize: 11, color: "#64748b" }}>Nº {getItemCode(it)} · {it.fornecedor || "—"}</span>
                  </span>
                </label>
              );
            })}
            {getSemTomboPendentes().length === 0 && (
              <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", textAlign: "center", padding: 12 }}>Nenhum pendente encontrado.</p>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>
            Selecionados: {(formRef.current.stSelectedIds || []).length}
          </p>
        </>
      )}

      <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
        <button onClick={() => { revokeBlobUrls(formRef.current.stPhotos || []); setModal(null); }} style={{ ...bs, flex: 1 }}>
          Cancelar
        </button>
        <button
          onClick={(formRef.current.stMode || "novo") === "pendentes" ? addSemTomboPendentes : addSemTomboItem}
          style={{ ...bp, flex: 1 }}
        >
          Registrar
        </button>
      </div>
    </Overlay>
  );
}
