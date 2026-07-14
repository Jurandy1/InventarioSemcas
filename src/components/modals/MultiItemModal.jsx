import React, { useState } from "react";
import { Overlay } from "../Overlay.jsx";
import { TInput, TArea } from "../FormFields.jsx";
import { ESTADOS } from "../../constants/inventory.js";
import { DoacaoOrigemFields } from "../DoacaoOrigemFields.jsx";
import { CorPicker } from "../CorPicker.jsx";

/**
 * Modal pra cadastrar N itens manuais que compartilham a MESMA descrição
 * mas têm tombamento, estado e foto individuais.
 *
 * Fluxo:
 *  1. Usuário define descrição/marca/fornecedor compartilhados (cabeçalho)
 *  2. Adiciona linhas — cada linha tem tombamento + estado + foto
 *  3. Botão "Salvar todos" dispara onSubmit(rows)
 */
export function MultiItemModal({
  isMob,
  unidadeAtiva,
  sessionLocais,
  sugestoes,
  onClose,
  onOpenCamera,         // (target: 'multi-row-<idx>') => void
  rowsPhotosRef,        // { current: { '0': [base64], '1': [...] } } — atualizado quando câmera retorna
  sharedRef,
  rowsRef,
  onSubmit,             // ({ shared, rows }) => Promise<void>
  bp,
  bs,
  inp,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [forceRender, setForceRender] = useState(0);
  const bump = () => setForceRender((n) => n + 1);

  const shared = sharedRef.current;
  const rows = rowsRef.current;

  const updateShared = (k, v) => {
    sharedRef.current = { ...sharedRef.current, [k]: v };
    bump();
  };

  const updateRow = (idx, k, v) => {
    rowsRef.current = rowsRef.current.map((row, i) => (i === idx ? { ...row, [k]: v } : row));
    bump();
  };

  const addRow = () => {
    rowsRef.current = [
      ...rowsRef.current,
      { tombamento: "", estado: "Bom", obs: "", cor: sharedRef.current?.corPadrao || "" },
    ];
    bump();
  };

  const removeRow = (idx) => {
    rowsRef.current = rowsRef.current.filter((_, i) => i !== idx);
    if (rowsPhotosRef?.current) {
      // Reindexa as fotos: sem isso, as fotos das linhas seguintes
      // ficavam associadas à linha errada após uma remoção.
      const next = {};
      for (const [k, v] of Object.entries(rowsPhotosRef.current)) {
        const n = Number(k);
        if (Number.isNaN(n) || n === idx) continue;
        next[String(n > idx ? n - 1 : n)] = v;
      }
      rowsPhotosRef.current = next;
    }
    bump();
  };

  const photoCountForRow = (idx) =>
    Array.isArray(rowsPhotosRef?.current?.[String(idx)])
      ? rowsPhotosRef.current[String(idx)].length
      : 0;

  const handleSubmit = async () => {
    if (submitting) return;
    const desc = String(shared.descricao || "").trim();
    if (!desc) {
      alert("Informe a descrição compartilhada");
      return;
    }
    if (!shared.localId) {
      alert("Selecione um local");
      return;
    }
    // Anexa as fotos a cada linha antes de filtrar — o salvamento não pode
    // depender do índice, que muda quando linhas vazias são descartadas.
    const validRows = rows
      .map((r, idx) => ({
        ...r,
        photos: Array.isArray(rowsPhotosRef?.current?.[String(idx)])
          ? rowsPhotosRef.current[String(idx)]
          : [],
      }))
      .filter((r) => String(r.tombamento || "").trim() || r.photos.length > 0);
    if (validRows.length === 0) {
      alert("Adicione ao menos um item com tombamento ou foto");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ shared, rows: validRows });
    } catch (e) {
      alert(`Erro ao salvar: ${e?.message || e}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Overlay isMobile={isMob} onClose={onClose} size="large">
      <div style={{ display: "flex", flexDirection: "column", maxHeight: "85vh" }}>
        <header style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #e2e8f0" }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>
            Adicionar vários itens
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
            Use isso quando você tem várias unidades do MESMO item (mesma descrição) mas
            cada uma pode ter tombamento, estado, cor e foto próprios.
          </p>
          {unidadeAtiva && (
            <p style={{ margin: "6px 0 0", fontSize: 11, fontWeight: 700, color: "#1351B4" }}>
              Unidade: {unidadeAtiva.nome}
            </p>
          )}
        </header>

        <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
          {/* Cabeçalho compartilhado */}
          <section
            style={{
              background: "#eff6ff",
              border: "1.5px solid #bfdbfe",
              borderRadius: 10,
              padding: 14,
              marginBottom: 14,
            }}
          >
            <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 800, color: "#1d4ed8" }}>
              Compartilhado por todos os itens
            </p>
            <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "1fr 1fr", gap: 8 }}>
              <TInput
                initial={shared.descricao}
                onVal={(v) => updateShared("descricao", v)}
                placeholder="Descrição (ex: Cadeira giratória preta)"
                style={inp}
                suggestions={sugestoes?.descricoes}
              />
              <TInput
                initial={shared.especie}
                onVal={(v) => updateShared("especie", v)}
                placeholder="Espécie (ex: CADEIRA)"
                style={inp}
                suggestions={sugestoes?.especies}
              />
              <TInput
                initial={shared.marca}
                onVal={(v) => updateShared("marca", v)}
                placeholder="Marca"
                style={inp}
                suggestions={sugestoes?.marcas}
              />
              <TInput
                initial={shared.fornecedor}
                onVal={(v) => updateShared("fornecedor", v)}
                placeholder="Fornecedor"
                style={inp}
                suggestions={sugestoes?.fornecedores}
              />
              <TInput
                initial={shared.valor}
                onVal={(v) => updateShared("valor", v)}
                placeholder="Valor unitário (R$)"
                style={inp}
              />
              <select
                value={shared.localId}
                onChange={(e) => updateShared("localId", e.target.value)}
                style={inp}
              >
                <option value="">— Selecione um local —</option>
                {sessionLocais.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 12 }}>
              <CorPicker
                isMob={isMob}
                label="Cor padrão (pode mudar por linha)"
                value={shared.corPadrao || ""}
                onChange={(v) => {
                  updateShared("corPadrao", v);
                  // Propaga só para linhas ainda sem cor própria
                  rowsRef.current = rowsRef.current.map((row) =>
                    row.cor ? row : { ...row, cor: v }
                  );
                  bump();
                }}
              />
            </div>

            <p style={{ margin: "12px 0 6px", fontSize: 12, fontWeight: 700, color: "#1d4ed8" }}>Origem</p>
            <div style={{ display: "flex", gap: 8 }}>
              {["Próprio", "Doação", "Permuta"].map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => updateShared("origem", o)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    minHeight: isMob ? 44 : undefined,
                    borderRadius: 9,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    touchAction: "manipulation",
                    border: `2px solid ${(shared.origem || "Próprio") === o ? "#1351B4" : "#e2e8f0"}`,
                    background: (shared.origem || "Próprio") === o ? "#dbeafe" : "#fff",
                    color: (shared.origem || "Próprio") === o ? "#1351B4" : "#6b7280",
                  }}
                >
                  {o}
                </button>
              ))}
            </div>
            {(shared.origem || "Próprio") === "Doação" && (
              <DoacaoOrigemFields
                prefix="multi"
                getField={(k) => sharedRef.current[k] || ""}
                setField={(k, v) => updateShared(k, v)}
                bumpFt={bump}
                inp={inp}
                ft={forceRender}
              />
            )}
          </section>

          {/* Linhas — cada item individual */}
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#0f172a" }}>
                Itens individuais ({rows.length})
              </p>
              <button onClick={addRow} style={{ ...bs, padding: "6px 12px", fontSize: 12 }}>
                + Adicionar linha
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rows.map((row, idx) => {
                const nFotos = photoCountForRow(idx);
                return (
                  <div
                    key={idx}
                    style={{
                      border: "1.5px solid #e2e8f0",
                      borderRadius: 10,
                      padding: 12,
                      background: "#fff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 10,
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>
                        Item {idx + 1}
                      </span>
                      {rows.length > 1 && (
                        <button
                          onClick={() => removeRow(idx)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#dc2626",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          Remover
                        </button>
                      )}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: isMob ? "1fr" : "2fr 1fr 1fr",
                        gap: 8,
                      }}
                    >
                      <TInput
                        initial={row.tombamento}
                        onVal={(v) => updateRow(idx, "tombamento", v)}
                        placeholder="Tombamento (ou deixe vazio se S/T)"
                        style={inp}
                      />
                      <select
                        value={row.estado}
                        onChange={(e) => updateRow(idx, "estado", e.target.value)}
                        style={inp}
                      >
                        {ESTADOS.map((est) => (
                          <option key={est} value={est}>
                            {est}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => onOpenCamera(`multi-row-${idx}`)}
                        style={{ ...bs, padding: "10px 12px", fontSize: 12 }}
                      >
                        {nFotos > 0 ? `${nFotos} foto(s)` : "Tirar foto"}
                      </button>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <CorPicker
                        isMob={isMob}
                        label={`Cor do item ${idx + 1}`}
                        value={row.cor || ""}
                        onChange={(v) => updateRow(idx, "cor", v)}
                      />
                    </div>
                    {row.obs !== undefined && (
                      <div style={{ marginTop: 8 }}>
                        <TArea
                          initial={row.obs}
                          onVal={(v) => updateRow(idx, "obs", v)}
                          placeholder="Observação (opcional)"
                          style={{ ...inp, minHeight: 50 }}
                        />
                      </div>
                    )}
                    {nFotos > 0 && rowsPhotosRef?.current?.[String(idx)] && (
                      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                        {rowsPhotosRef.current[String(idx)].slice(0, 6).map((src, i) => (
                          <img
                            key={i}
                            src={src}
                            alt=""
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 6,
                              objectFit: "cover",
                              border: "1.5px solid #e2e8f0",
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <footer
          style={{
            paddingTop: 12,
            marginTop: 12,
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <button onClick={onClose} style={{ ...bs, flex: 1 }} disabled={submitting}>
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            style={{ ...bp, flex: 2, opacity: submitting ? 0.6 : 1 }}
            disabled={submitting}
          >
            {submitting ? "Salvando..." : `Salvar ${rows.length} itens`}
          </button>
        </footer>
      </div>
    </Overlay>
  );
}
