import React, { useState } from "react";
import { Overlay } from "../Overlay.jsx";
import { TInput, TArea } from "../FormFields.jsx";
import { Badge } from "../Badge.jsx";
import { ESTADOS } from "../../constants/inventory.js";

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
  onSubmit,             // ({ shared, rows }) => Promise<void>
  bp,
  bs,
  inp,
}) {
  const [shared, setShared] = useState({
    descricao: "",
    especie: "",
    marca: "",
    fornecedor: "",
    valor: "",
    localId: sessionLocais[0]?.id || "",
    origem: "Próprio",
  });
  const [rows, setRows] = useState([
    { tombamento: "", estado: "Bom", obs: "" },
    { tombamento: "", estado: "Bom", obs: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [forceRender, setForceRender] = useState(0);
  const bump = () => setForceRender((n) => n + 1);

  const updateShared = (k, v) => setShared((s) => ({ ...s, [k]: v }));
  const updateRow = (idx, k, v) =>
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, [k]: v } : row)));

  const addRow = () =>
    setRows((r) => [...r, { tombamento: "", estado: "Bom", obs: "" }]);

  const removeRow = (idx) => {
    setRows((r) => r.filter((_, i) => i !== idx));
    if (rowsPhotosRef?.current) {
      delete rowsPhotosRef.current[String(idx)];
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
    const validRows = rows.filter(
      (r) => String(r.tombamento || "").trim() || photoCountForRow(rows.indexOf(r)) > 0
    );
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
            cada uma com tombamento, estado de conservação e foto próprios.
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
