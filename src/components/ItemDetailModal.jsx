import React, { useEffect, useState } from "react";
import { TArea, TInput } from "./FormFields.jsx";
import { EC, ESTADOS, SITUACOES } from "../constants/inventory.js";
import { deletePhoto, getDisplayPhotoUrl } from "../services/storage.js";
import { isSemTomboItem, showFotoManualBadge } from "../utils/semTombo.js";
import { ItemHistory } from "./ItemHistory.jsx";
import { isItemInventariado } from "../utils/patrimonioId.js";
import { inferEspecieFromDesc, supportsImei } from "../utils/itemHelpers.js";
import { PhotoThumb } from "./PhotoThumb.jsx";
import { SmartImg } from "./SmartImg.jsx";

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
  onViewImage,
  onClose,
  onSave,
  onDelete,
}) {
  // Re-render local sem trocar as keys (bumpFt remontaria o input em edição).
  const [, refreshLocal] = React.useReducer((n) => n + 1, 0);
  if (!item) return null;
  const semTombo = isSemTomboItem(item, foundEntry);
  const showImei = supportsImei(
    `${formRef.current.detDescricao || ""} ${formRef.current.detEspecie || ""} ${item.descricao || ""} ${item.especie || ""}`
  );
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
            padding: isMobile ? "12px 4px" : "8px 4px",
            minHeight: isMobile ? 44 : undefined,
            borderRadius: 8,
            fontSize: isMobile ? 13 : 11,
            fontWeight: 700,
            cursor: "pointer",
            touchAction: "manipulation",
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

  const handleSaveWithValidation = () => {
    // Validação: verificar se o estado foi selecionado explicitamente
    const estado = formRef.current.detEstado;
    if (!estado || estado.trim() === "") {
      alert("Por favor, selecione um Estado de Conservação antes de salvar.");
      return;
    }

    // Validação: verificar se uma situação foi selecionada
    const situacao = getField("detSituacao") || "Em uso";
    if (!situacao || situacao.trim() === "") {
      alert("Por favor, selecione uma Situação antes de salvar.");
      return;
    }

    // Se for permuta, validar campos obrigatórios
    if (situacao === "Permuta") {
      const permutaDesc = String(getField("detPermutaDesc") || "").trim();
      if (!permutaDesc) {
        alert("Para items em Permuta, descreva o item encontrado no lugar.");
        return;
      }
    }

    // Chama a função onSave original
    onSave?.();
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, flex: 1, minWidth: 0 }}>{item.descricao || item.especie || "—"}</h2>
        <button onClick={onClose} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, color: "#334155", cursor: "pointer", padding: isMobile ? "10px 16px" : "8px 12px", minHeight: isMobile ? 44 : undefined, fontWeight: 700, touchAction: "manipulation", flexShrink: 0 }}>
          Fechar
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
          Inventariado por: {foundEntry.usuario || foundEntry.user || "—"} em {foundEntry.data || "—"}
          {foundEntry.hora ? ` às ${foundEntry.hora}` : ""}
          {foundEntry.ultimoUsuarioAnterior &&
            foundEntry.ultimoUsuarioAnterior !== (foundEntry.usuario || foundEntry.user) && (
              <span style={{ display: "block", color: "#64748b", fontWeight: 400 }}>(Anterior: {foundEntry.ultimoUsuarioAnterior})</span>
            )}
        </p>
      )}

      {semTombo && (
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#92400e" }}>Item sem tombo</p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#78350f", lineHeight: 1.45 }}>
            Identificado por foto e descrição. Informe o tombo sugerido abaixo para facilitar a vinculação posterior.
          </p>
        </div>
      )}

      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
        <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "#334155" }}>Dados editáveis do item</p>
        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#374151" }}>Descrição</p>
        <TInput
          key={`detDesc_${ft}`}
          initial={formRef.current.detDescricao}
          onVal={(v) => {
            setField("detDescricao", v);
            // Auto-identifica a espécie enquanto o campo não foi editado à mão
            // e estava vazio ao abrir (não sobrescreve espécie da planilha).
            const podeAuto =
              !formRef.current.detEspecieTouched &&
              (!String(formRef.current.detEspecie || "").trim() || formRef.current.detEspecieAuto);
            if (podeAuto) {
              const inferred = inferEspecieFromDesc(v, sugestoes?.especies);
              if (inferred !== formRef.current.detEspecie) {
                setField("detEspecie", inferred);
                formRef.current.detEspecieAuto = true;
              }
            }
            refreshLocal();
          }}
          placeholder="Descrição do item..."
          suggestions={sugestoes?.descricoes}
          style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9, padding: "10px 13px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none", marginBottom: 0 }}
        />
        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#374151" }}>
          Espécie / Tipo
          {formRef.current.detEspecieAuto && !formRef.current.detEspecieTouched && (
            <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "#0f766e", background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 99, padding: "2px 8px" }}>
              identificada automaticamente
            </span>
          )}
        </p>
        <TInput
          key={`detEsp_${ft}`}
          initial={formRef.current.detEspecie}
          onVal={(v) => {
            setField("detEspecie", v);
            formRef.current.detEspecieTouched = true;
          }}
          placeholder="Ex: CADEIRA, MESA, TELEVISOR..."
          suggestions={sugestoes?.especies}
          style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9, padding: "10px 13px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
        />
        <p style={{ margin: "8px 0 0", fontSize: 10, color: "#64748b" }}>Tombo, fornecedor, NF e valor não podem ser alterados.</p>
      </div>

      {semTombo && (
        <>
          <Lbl>Tombamento sugerido / referência</Lbl>
          <TInput
            key={`detTomboRef_${ft}`}
            initial={formRef.current.detTomboRef}
            onVal={(v) => setField("detTomboRef", v)}
            placeholder="Número do patrimônio, se souber..."
            style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9, padding: "10px 13px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
          />
        </>
      )}

      {(() => {
        const photoList = [...(formRef.current.detExistingUrls || []), ...(formRef.current.detNewBase64 || [])];
        return (
          <div key={`photos_${ft}`} style={{ marginBottom: 14 }}>
            {photoList.length > 0 ? (
              <div>
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
                  {photoList.map((ph, i) => (
                    <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                      <PhotoThumb
                        src={ph}
                        badge={showFotoManualBadge(item, foundEntry)}
                        size={photoList.length === 1 ? (isMobile ? 160 : 200) : isMobile ? 160 : 200}
                        imgStyle={{
                          width: photoList.length === 1 ? "100%" : isMobile ? 160 : 200,
                          height: photoList.length === 1 ? 180 : isMobile ? 120 : 140,
                          borderRadius: 10,
                          border: "1px solid #e2e8f0",
                        }}
                        onImageClick={() => onViewImage?.(ph)}
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
                            const old = newb64[idx];
                            if (String(old || "").startsWith("blob:")) {
                              try {
                                URL.revokeObjectURL(String(old));
                              } catch {}
                            }
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
                          width: isMobile ? 32 : 22,
                          height: isMobile ? 32 : 22,
                          fontSize: isMobile ? 16 : 12,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          touchAction: "manipulation",
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
                  Adicionar mais fotos ({photoList.length})
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
                <span style={{ fontSize: 14, color: "#64748b", fontWeight: 600 }}>Adicionar fotos</span>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>Item, plaqueta, estado de conservação</span>
              </button>
            )}
          </div>
        );
      })()}

      <Lbl>Local</Lbl>
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
                minHeight: isMobile ? 44 : undefined,
                borderRadius: 9,
                fontSize: isMobile ? 13 : 12,
                fontWeight: 700,
                cursor: "pointer",
                touchAction: "manipulation",
                border: `2px solid ${(formRef.current.detOrigem || "Próprio") === o ? "#1351B4" : "#e2e8f0"}`,
                background: (formRef.current.detOrigem || "Próprio") === o ? "#dbeafe" : "#fff",
                color: (formRef.current.detOrigem || "Próprio") === o ? "#1351B4" : "#6b7280",
              }}
            >
              {o}
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

      {showImei && (
        <>
          <Lbl>IMEI / Nº de série</Lbl>
          <TInput
            key={`detImei_${ft}`}
            initial={formRef.current.detImei}
            onVal={(v) => setField("detImei", v)}
            inputMode="numeric"
            placeholder="Ex: 356938035643809"
            style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9, padding: "10px 13px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
          />
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "#64748b" }}>
            Em tablets/celulares: Configurações → Sobre o dispositivo, ou etiqueta atrás do aparelho.
          </p>
        </>
      )}

      {!semTombo && (
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            marginTop: 14,
            padding: "12px 14px",
            borderRadius: 10,
            border: `1.5px solid ${formRef.current.detPlaquetaAusente ? "#fdba74" : "#e2e8f0"}`,
            background: formRef.current.detPlaquetaAusente ? "#fff7ed" : "#f8fafc",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={!!formRef.current.detPlaquetaAusente}
            onChange={(e) => {
              formRef.current.detPlaquetaAusente = e.target.checked;
              refreshLocal();
            }}
            style={{ marginTop: 2, width: 18, height: 18, minHeight: 0 }}
          />
          <span>
            <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#9a3412" }}>
              Item sem plaqueta de tombamento
            </span>
            <span style={{ display: "block", fontSize: 11, color: "#78350f", marginTop: 2, lineHeight: 1.4 }}>
              Encontrei o item, mas a etiqueta/plaqueta física está ausente ou ilegível — precisa fixar nova plaqueta.
            </span>
          </span>
        </label>
      )}

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
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 800, color: "#92400e" }}>Item encontrado no lugar (Permuta)</p>
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
            style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9, padding: "10px 13px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none", marginBottom: 0 }}
          />

          <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#374151" }}>Marca do item real</p>
          <TInput
            key={`permMarca_${ft}`}
            initial={formRef.current.detPermutaMarca}
            onVal={(v) => setField("detPermutaMarca", v)}
            placeholder="Ex: Samsung, Tramontina..."
            suggestions={sugestoes?.marcas}
            style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9, padding: "10px 13px", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none", marginBottom: 0 }}
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
          <p style={{ margin: "10px 0 0", fontSize: 10, color: "#92400e" }}>Estes dados ficarão registrados no inventário e aparecerão na aba Notas Fiscais.</p>
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

      <ItemHistory itemId={item.id} />

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
        {isItemInventariado(item.id, foundSet) && (
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
            Remover
          </button>
        )}
        <button
          onClick={handleSaveWithValidation}
          style={{
            background: "#1351B4",
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
          {foundSet?.has(item.id) ? "Salvar" : "Marcar como encontrado"}
        </button>
      </div>
    </>
  );
}
