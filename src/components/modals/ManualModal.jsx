import React from "react";
import { Overlay } from "../Overlay.jsx";
import { TInput } from "../FormFields.jsx";
import { DoacaoOrigemFields } from "../DoacaoOrigemFields.jsx";
import { SmartImg } from "../SmartImg.jsx";

export function ManualModal({
  isMob,
  overlayBackdropSuppressMs,
  revokeBlobUrls,
  formRef,
  clearUiResume,
  setModal,
  getField,
  setField,
  inferEspecieFromDesc,
  sugestoes,
  bumpFt,
  manualPatrimonioRef,
  bs,
  inp,
  bp,
  ESTADOS,
  EC,
  SITUACOES,
  pickLocais,
  openCamera,
  onViewImage,
  addManual,
  ft,
}) {
  return (
    <Overlay
      isMobile={isMob}
      suppressBackdropMs={isMob ? Math.max(overlayBackdropSuppressMs, 400) : overlayBackdropSuppressMs}
      onClose={() => {
        revokeBlobUrls(formRef.current.manPhotos || []);
        clearUiResume();
        setModal(null);
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Adicionar Manual</h2>
        <button
          onClick={() => {
            revokeBlobUrls(formRef.current.manPhotos || []);
            clearUiResume();
            setModal(null);
          }}
          style={{ background: "none", border: "none", fontSize: 20, color: "#64748b", cursor: "pointer", padding: "4px 8px", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          Fechar
        </button>
      </div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Descrição *</label>
      <TInput
        key={"manDesc_" + ft}
        initial={getField("manDesc")}
        onVal={(v) => {
          setField("manDesc", v);
        }}
        placeholder="Descreva o item..."
        suggestions={sugestoes.descricoes}
        style={inp}
      />
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Nº do Patrimônio</label>
      <input
        ref={manualPatrimonioRef}
        key={"manPat_" + ft}
        defaultValue={getField("manPatrimonio")}
        onChange={(e) => setField("manPatrimonio", e.target.value)}
        placeholder="Digite o patrimônio ou S/T"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        style={inp}
      />
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Quantidade</label>
      <input
        key={"manQtd_" + ft}
        defaultValue={String(formRef.current.manQtd || 1)}
        onChange={(e) => {
          const n = Math.max(1, Math.min(50, Math.floor(Number(e.target.value || 1) || 1)));
          formRef.current.manQtd = n;
          bumpFt();
        }}
        type="number"
        min={1}
        max={50}
        step={1}
        inputMode="numeric"
        style={inp}
      />
      <p style={{ margin: "6px 0 0", fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>
        Para economizar fotos no Firebase, uma mesma foto pode ser aplicada a todos os itens desta quantidade.
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 8, marginBottom: 2 }}>
        <button
          onClick={() => {
            formRef.current.manPatrimonio = "S/T";
            if (manualPatrimonioRef.current) {
              manualPatrimonioRef.current.value = "S/T";
              manualPatrimonioRef.current.focus();
            }
          }}
          style={{ ...bs, fontSize: 12, padding: "8px 12px" }}
        >
          Marcar S/T
        </button>
        <span style={{ fontSize: 11, color: "#64748b", alignSelf: "center" }}>Se deixar em branco, o sistema gera um código automático.</span>
      </div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Espécie</label>
      <TInput key={"manEsp_" + ft} initial={getField("manEspecie")} onVal={(v) => setField("manEspecie", v)} placeholder="Ex: CADEIRA, MESA..." style={inp} />
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Marca</label>
      <TInput key="manMarca" initial={getField("manMarca")} onVal={(v) => setField("manMarca", v)} placeholder="Marca..." style={inp} />
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Fornecedor</label>
      <TInput key="manForn" initial={getField("manFornecedor")} onVal={(v) => setField("manFornecedor", v)} placeholder="Fornecedor..." style={inp} />
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Valor</label>
      <TInput key="manVal" initial={getField("manValor")} onVal={(v) => setField("manValor", v)} type="number" placeholder="0.00" style={inp} />
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Origem</label>
      <div style={{ display: "flex", gap: 8 }}>
        {["Próprio", "Doação", "Permuta"].map((o) => (
          <button
            key={o}
            onClick={() => {
              formRef.current.manOrigem = o;
              bumpFt();
            }}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: 9,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              border: `2px solid ${(formRef.current.manOrigem || "Próprio") === o ? "#1351B4" : "#e2e8f0"}`,
              background: (formRef.current.manOrigem || "Próprio") === o ? "#dbeafe" : "#fff",
              color: (formRef.current.manOrigem || "Próprio") === o ? "#1351B4" : "#6b7280",
            }}
          >
            {o}
          </button>
        ))}
      </div>
      {(formRef.current.manOrigem || "Próprio") === "Doação" && (
        <DoacaoOrigemFields prefix="man" getField={getField} setField={setField} bumpFt={bumpFt} inp={inp} ft={ft} />
      )}
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Estado de Conservação</label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
        {ESTADOS.map((e) => (
          <button
            key={e}
            onClick={() => {
              formRef.current.manEstado = e;
              bumpFt();
            }}
            style={{
              padding: "8px 4px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              border: `2px solid ${(formRef.current.manEstado || "Bom") === e ? EC[e].tx : "#e2e8f0"}`,
              background: (formRef.current.manEstado || "Bom") === e ? EC[e].bg : "#fff",
              color: (formRef.current.manEstado || "Bom") === e ? EC[e].tx : "#6b7280",
            }}
          >
            {e}
          </button>
        ))}
      </div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Situação</label>
      <select key="manSit" defaultValue={getField("manSituacao") || "Em uso"} onChange={(e) => setField("manSituacao", e.target.value)} style={inp}>
        {SITUACOES.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Local</label>
      <select key={"manLocal_" + ft} defaultValue={getField("manLocal") || ""} onChange={(e) => { setField("manLocal", e.target.value); bumpFt(); }} style={inp}>
        <option value="">{pickLocais.length ? "— Selecione —" : "— Crie um local na sessão —"}</option>
        {pickLocais.map((l) => (
          <option key={l.id} value={l.id}>
            {l.nome}
          </option>
        ))}
      </select>
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>Fotos</label>
      {Number(formRef.current.manQtd || 1) > 1 && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 8px", fontSize: 12, color: "#334155", fontWeight: 700 }}>
          <input
            type="checkbox"
            checked={formRef.current.manSharePhotos !== false}
            onChange={(e) => {
              formRef.current.manSharePhotos = !!e.target.checked;
              bumpFt();
            }}
          />
          Usar as mesmas fotos para todos
        </label>
      )}
      {formRef.current.manPhotos?.length > 0 ? (
        <div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {formRef.current.manPhotos.map((ph, i) => (
              <div key={i} style={{ position: "relative" }}>
                <SmartImg
                  src={ph}
                  alt=""
                  style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 6, cursor: "zoom-in" }}
                  onClick={() => onViewImage(ph)}
                />
                <button
                  onClick={() => {
                    const old = formRef.current.manPhotos?.[i];
                    if (String(old || "").startsWith("blob:")) {
                      try {
                        URL.revokeObjectURL(String(old));
                      } catch {}
                    }
                    formRef.current.manPhotos = formRef.current.manPhotos.filter((_, j) => j !== i);
                    bumpFt();
                  }}
                  style={{ position: "absolute", top: -4, right: -4, background: "#dc2626", color: "#fff", border: "none", borderRadius: "50%", width: 16, height: 16, fontSize: 9, cursor: "pointer" }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => openCamera("manual")} style={{ width: "100%", border: "1.5px dashed #93c5fd", background: "#eff6ff", borderRadius: 8, padding: 8, cursor: "pointer", fontSize: 12, color: "#1d4ed8", fontWeight: 600 }}>
            + Mais fotos
          </button>
        </div>
      ) : (
        <button onClick={() => openCamera("manual")} style={{ width: "100%", border: "2px dashed #cbd5e1", background: "#f8fafc", borderRadius: 10, padding: 16, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>Adicionar fotos</span>
        </button>
      )}
      <div style={{ display: "flex", gap: 9, marginTop: 16, flexWrap: "wrap" }}>
        <button onClick={() => { revokeBlobUrls(formRef.current.manPhotos || []); clearUiResume(); setModal(null); }} style={{ ...bs, flex: 1 }}>
          Cancelar
        </button>
        <button onClick={addManual} style={{ ...bp, flex: 1 }}>
          Criar
        </button>
      </div>
    </Overlay>
  );
}
