import React, { useEffect, useState } from "react";
import { TArea, TInput } from "./FormFields.jsx";
import { EC, ESTADOS, SITUACOES } from "../constants/inventory.js";
import { deletePhoto, getDisplayPhotoUrl } from "../services/storage.js";

function SmartImg({ src, alt = "", style, ...rest }) {
  const [resolved, setResolved] = useState(src || "");
  useEffect(() => {
    let alive = true;
    setResolved(src || "");
    (async () => {
      const next = await getDisplayPhotoUrl(src);
      if (!alive) return;
      setResolved(next || src || "");
    })();
    return () => {
      alive = false;
    };
  }, [src]);
  return <img src={resolved} alt={alt} style={style} {...rest} />;
}

export function ItemDetailModal({
  item,
  foundEntry,
  foundSet,
  locais,
  origemMeta,
  isMobile,
  ft,
  bumpFt,
  formRef,
  setField,
  getField,
  sugestoes,
  onOpenCamera,
  onClose,
  onSave,
  onDelete,
}) {
  if (!item) return null;
  const Lbl = ({ children }) => <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 14 }}>{children}</label>;

  const EGrid = ({ fk }) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
      {ESTADOS.map((e) => (
        <button
          key={e}
          onClick={() => {
            formRef.current[fk] = e;
            bumpFt();
          }}
          style={{
            padding: "8px 4px",
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            border: `2px solid ${(formRef.current[fk] || "Bom") === e ? EC[e].tx : "#e2e8f0"}`,
            background: (formRef.current[fk] || "Bom") === e ? EC[e].bg : "#fff",
            color: (formRef.current[fk] || "Bom") === e ? EC[e].tx : "#6b7280",
          }}
        >
          {e}
        </button>
      ))}
    </div>
  );

  const getItemCode = (it) => it?.patrimonioLabel || it?.id || "—";

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, flex: 1, minWidth: 0 }}>{item.descricao || item.especie || "—"}</h2>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#64748b", cursor: "pointer", padding: "4px 8px", lineHeight: 1 }}>
          ✕
        </button>
      </div>

      <p style={{ margin: "0 0 4px", fontSize: 12, color: "#64748b" }}>
        Nº {getItemCode(item)} · {item.data} · R$ {(item.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
      </p>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "#94a3b8", overflowWrap: "anywhere" }}>
        Fornecedor: {item.fornecedor || "—"} · NF: {item.nf || "—"} · Empenho: {item.empenho || "—"}
      </p>

      {foundEntry && (
        <p style={{ margin: "4px 0 12px", fontSize: 11, color: "#10b981", fontWeight: 600 }}>
          ✅ Inventariado por: {foundEntry.usuario || foundEntry.user || "—"} em {foundEntry.data || "—"}
          {foundEntry.hora ? ` às ${foundEntry.hora}` : ""}
          {foundEntry.ultimoUsuarioAnterior &&
            foundEntry.ultimoUsuarioAnterior !== (foundEntry.usuario || foundEntry.user) && (
              <span style={{ display: "block", color: "#64748b", fontWeight: 400 }}>(Anterior: {foundEntry.ultimoUsuarioAnterior})</span>
            )}
        </p>
      )}

      <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
        <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 800, color: "#0369a1" }}>✏️ Dados Editáveis do Item</p>
        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#374151" }}>Descrição</p>
        <TInput
          key={`detDesc_${ft}`}
          initial={formRef.current.detDescricao}
          onVal={(v) => setField("detDescricao", v)}
          placeholder="Descrição do item..."
          style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9, padding: "10px 13px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none", marginBottom: 10 }}
        />
        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#374151" }}>Espécie / Tipo</p>
        <TInput
          key={`detEsp_${ft}`}
          initial={formRef.current.detEspecie}
          onVal={(v) => setField("detEspecie", v)}
          placeholder="Ex: CADEIRA, MESA, TELEVISOR..."
          suggestions={sugestoes?.especies}
          style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9, padding: "10px 13px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
        />
        <p style={{ margin: "8px 0 0", fontSize: 10, color: "#64748b" }}>🔒 Tombo, Fornecedor, NF e Valor não podem ser alterados.</p>
      </div>

      {(() => {
        const photoList = [...(formRef.current.detExistingUrls || []), ...(formRef.current.detNewBase64 || [])];
        return (
          <div style={{ marginBottom: 14 }}>
            {photoList.length > 0 ? (
              <div>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
                  {photoList.map((ph, i) => (
                    <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                      <SmartImg
                        src={ph}
                        alt=""
                        style={{
                          width: photoList.length === 1 ? "100%" : isMobile ? 160 : 200,
                          height: photoList.length === 1 ? 180 : isMobile ? 120 : 140,
                          objectFit: "cover",
                          borderRadius: 10,
                          border: "1px solid #e2e8f0",
                        }}
                      />
                      <button
                        onClick={() => {
                          const existing = formRef.current.detExistingUrls || [];
                          const newb64 = formRef.current.detNewBase64 || [];
                          if (i < existing.length) {
                            const url = existing[i];
                            formRef.current.detExistingUrls = existing.filter((_, j) => j !== i);
                            deletePhoto(url);
                          } else {
                            const idx = i - existing.length;
                            formRef.current.detNewBase64 = newb64.filter((_, j) => j !== idx);
                          }
                          bumpFt();
                        }}
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          background: "rgba(220,38,38,.85)",
                          color: "#fff",
                          border: "none",
                          borderRadius: "50%",
                          width: 22,
                          height: 22,
                          fontSize: 12,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => onOpenCamera?.("detalhe")}
                  style={{
                    width: "100%",
                    border: "1.5px dashed #93c5fd",
                    background: "#eff6ff",
                    borderRadius: 8,
                    padding: "10px",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#1d4ed8",
                    fontWeight: 600,
                    marginTop: 4,
                  }}
                >
                  📷 Adicionar mais fotos ({photoList.length})
                </button>
              </div>
            ) : (
              <button
                onClick={() => onOpenCamera?.("detalhe")}
                style={{
                  width: "100%",
                  border: "2px dashed #cbd5e1",
                  background: "#f8fafc",
                  borderRadius: 12,
                  padding: 24,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 36 }}>📷</span>
                <span style={{ fontSize: 14, color: "#64748b", fontWeight: 600 }}>Tirar fotos do patrimônio</span>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>Item, plaqueta, estado de conservação</span>
              </button>
            )}
          </div>
        );
      })()}

      <Lbl>📍 Local</Lbl>
      <select defaultValue={formRef.current.detLocal} onChange={(e) => setField("detLocal", e.target.value)} style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9, padding: "10px 13px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}>
        <option value="">— Sem local —</option>
        {locais.map((l) => (
          <option key={l.id} value={l.id}>
            {l.nome}
          </option>
        ))}
      </select>

      <Lbl>Origem</Lbl>
      {formRef.current.detOrigemLocked ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 10,
            background: (origemMeta[formRef.current.detOrigem || "Próprio"] || origemMeta["Próprio"]).bg,
            color: (origemMeta[formRef.current.detOrigem || "Próprio"] || origemMeta["Próprio"]).tx,
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          <span style={{ fontSize: 14 }}>{(origemMeta[formRef.current.detOrigem || "Próprio"] || origemMeta["Próprio"]).ico}</span>
          <span>{formRef.current.detOrigem || "Próprio"}</span>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          {["Próprio", "Doação", "Permuta"].map((o) => (
            <button
              key={o}
              onClick={() => {
                formRef.current.detOrigem = o;
                bumpFt();
              }}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 9,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                border: `2px solid ${(formRef.current.detOrigem || "Próprio") === o ? "#1e3a8a" : "#e2e8f0"}`,
                background: (formRef.current.detOrigem || "Próprio") === o ? "#dbeafe" : "#fff",
                color: (formRef.current.detOrigem || "Próprio") === o ? "#1e3a8a" : "#6b7280",
              }}
            >
              {o === "Próprio" ? "🏛️ Próprio" : o === "Doação" ? "🎁 Doação" : "🔄 Permuta"}
            </button>
          ))}
        </div>
      )}

      <Lbl>Marca (se diferente do relatório)</Lbl>
      <TInput
        initial={formRef.current.detMarca}
        onVal={(v) => setField("detMarca", v)}
        placeholder="Ex: Tramontina..."
        style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9, padding: "10px 13px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
      />

      <Lbl>Estado de Conservação</Lbl>
      <EGrid fk="detEstado" />

      <Lbl>Situação</Lbl>
      <select
        defaultValue={formRef.current.detSituacao}
        onChange={(e) => {
          setField("detSituacao", e.target.value);
          bumpFt();
        }}
        style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9, padding: "10px 13px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
      >
        {SITUACOES.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>

      {(getField("detSituacao") || "Em uso") === "Permuta" && (
        <div style={{ background: "#fffbeb", border: "2px solid #fcd34d", borderRadius: 12, padding: "14px 16px", marginTop: 14 }}>
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 800, color: "#92400e" }}>🔄 Item Encontrado no Lugar</p>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#78350f" }}>
            O sistema registra "{item.descricao || item.especie}" mas fisicamente há outro item. Descreva o que está lá:
          </p>

          <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#374151" }}>Descrição do item real *</p>
          <TInput
            key={`permDesc_${ft}`}
            initial={formRef.current.detPermutaDesc}
            onVal={(v) => setField("detPermutaDesc", v)}
            placeholder="Ex: Televisor 43 polegadas, Cadeira giratória..."
            suggestions={sugestoes?.descricoes}
            style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9, padding: "10px 13px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none", marginBottom: 10 }}
          />

          <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#374151" }}>Marca do item real</p>
          <TInput
            key={`permMarca_${ft}`}
            initial={formRef.current.detPermutaMarca}
            onVal={(v) => setField("detPermutaMarca", v)}
            placeholder="Ex: Samsung, Tramontina..."
            suggestions={sugestoes?.marcas}
            style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9, padding: "10px 13px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none", marginBottom: 10 }}
          />

          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#374151" }}>Estado do item real</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
            {ESTADOS.map((e) => (
              <button
                key={e}
                onClick={() => {
                  formRef.current.detPermutaEstado = e;
                  bumpFt();
                }}
                style={{
                  padding: "8px 4px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: `2px solid ${(formRef.current.detPermutaEstado || "Bom") === e ? EC[e].tx : "#e2e8f0"}`,
                  background: (formRef.current.detPermutaEstado || "Bom") === e ? EC[e].bg : "#fff",
                  color: (formRef.current.detPermutaEstado || "Bom") === e ? EC[e].tx : "#6b7280",
                }}
              >
                {e}
              </button>
            ))}
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 10, color: "#92400e" }}>📋 Estes dados ficarão registrados no inventário e aparecerão na aba Notas Fiscais.</p>
        </div>
      )}

      <Lbl>Observações</Lbl>
      <TArea
        initial={formRef.current.detObs}
        onVal={(v) => setField("detObs", v)}
        rows={2}
        placeholder="Anotações..."
        style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9, padding: "10px 13px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none", resize: "none" }}
      />

      <div style={{ display: "flex", gap: 9, marginTop: 16, flexDirection: isMobile ? "column" : "row" }}>
        <button
          onClick={onClose}
          style={{
            background: "#f1f5f9",
            color: "#334155",
            border: "1px solid #cbd5e1",
            borderRadius: 9,
            padding: "11px 18px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            flex: 1,
          }}
        >
          Cancelar
        </button>
        {foundSet?.has(item.id) && (
          <button
            onClick={onDelete}
            style={{
              background: "#f1f5f9",
              color: "#dc2626",
              border: "1px solid #cbd5e1",
              borderRadius: 9,
              padding: "11px 18px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              flex: 1,
            }}
          >
            🗑
          </button>
        )}
        <button
          onClick={onSave}
          style={{
            background: "#1e3a8a",
            color: "#fff",
            border: "none",
            borderRadius: 9,
            padding: "11px 18px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            flex: 1,
          }}
        >
          ✓ {foundSet?.has(item.id) ? "Salvar" : "Encontrado"}
        </button>
      </div>
    </>
  );
}

