import React, { useEffect, useState } from "react";
import { Badge } from "../components/Badge.jsx";
import { TInput, TArea } from "../components/FormFields.jsx";
import {
  obterCoordenadores,
  gerarLinkConviteCoordinador,
  aprovarCoordenador,
  rejeitarCoordenador,
  desativarCoordenador,
} from "../services/firebase.js";

export function CoordenadoresTab({ unidades, showT, isMob }) {
  const [coordPendentes, setCoordPendentes] = useState([]);
  const [coordAprovadas, setCoordAprovadas] = useState([]);
  const [coordRejeitadas, setCoordRejeitadas] = useState([]);
  const [tab, setTab] = useState("pendentes");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [selectedCoord, setSelectedCoord] = useState(null);
  const [form, setForm] = useState({ motivo: "", observacoes: "" });
  const [novoConvite, setNovoConvite] = useState({ unidadeId: "", matricula: "" });
  const [linkGerado, setLinkGerado] = useState(null);

  const carregarCoord = async () => {
    setLoading(true);
    try {
      const pendentes = await obterCoordenadores("pendente_aprovacao");
      const aprovadas = await obterCoordenadores("aprovada");
      const rejeitadas = await obterCoordenadores("rejeitada");

      setCoordPendentes(pendentes);
      setCoordAprovadas(aprovadas);
      setCoordRejeitadas(rejeitadas);
    } catch (e) {
      console.error("Erro ao carregar coordenadores:", e);
      showT("Erro ao carregar coordenadores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarCoord();
  }, []);

  const handleAprovar = async () => {
    if (!selectedCoord) return;
    try {
      await aprovarCoordenador(selectedCoord.uid, form.observacoes);
      showT("Coordenadora aprovada!");
      setModal(null);
      carregarCoord();
    } catch (e) {
      showT("Erro ao aprovar: " + e.message);
    }
  };

  const handleRejeitar = async () => {
    if (!selectedCoord) return;
    try {
      await rejeitarCoordenador(selectedCoord.uid, form.motivo);
      showT("Coordenadora rejeitada");
      setModal(null);
      carregarCoord();
    } catch (e) {
      showT("Erro ao rejeitar: " + e.message);
    }
  };

  const handleDesativar = async () => {
    if (!selectedCoord) return;
    try {
      await desativarCoordenador(selectedCoord.uid, form.motivo);
      showT("Coordenadora desativada");
      setModal(null);
      carregarCoord();
    } catch (e) {
      showT("Erro ao desativar: " + e.message);
    }
  };

  const handleGerarConvite = async () => {
    if (!novoConvite.unidadeId) {
      showT("Selecione uma unidade");
      return;
    }
    try {
      const unidadeNome = (unidades.find((u) => u.id === novoConvite.unidadeId)?.nome || "").trim();
      const { convite, link } = await gerarLinkConviteCoordinador(novoConvite.unidadeId, unidadeNome, novoConvite.matricula);
      setLinkGerado({ convite, link });
    } catch (e) {
      showT("Erro ao gerar convite: " + e.message);
    }
  };

  const inp = {
    width: "100%",
    border: "1.5px solid #d1d5db",
    borderRadius: 9,
    padding: "10px 13px",
    fontSize: 14,
    fontFamily: "inherit",
    boxSizing: "border-box",
    outline: "none",
  };

  const bp = {
    background: "#1e3a8a",
    color: "#fff",
    border: "none",
    borderRadius: 9,
    padding: "11px 18px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  };

  const bs = {
    background: "#f1f5f9",
    color: "#334155",
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    padding: "11px 18px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  };

  const cd = {
    background: "#fff",
    borderRadius: 12,
    padding: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,.06)",
  };

  const Overlay = ({ children, onClose }) => (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.5)",
        zIndex: 300,
        display: "flex",
        alignItems: isMob ? "flex-end" : "center",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: isMob ? "20px 20px 0 0" : 16,
          width: isMob ? "100%" : "560px",
          maxHeight: isMob ? "90dvh" : "85vh",
          overflowY: "auto",
          padding: 24,
          paddingBottom: isMob ? "calc(24px + env(safe-area-inset-bottom, 0px))" : 24,
        }}
      >
        {children}
      </div>
    </div>
  );

  const CoordCard = ({ coord, action }) => {
    const statusColor = {
      pendente_aprovacao: { bg: "#fff7ed", tx: "#c2410c" },
      aprovada: { bg: "#f0fdf4", tx: "#15803d" },
      rejeitada: { bg: "#fee2e2", tx: "#b91c1c" },
      desativada: { bg: "#f1f5f9", tx: "#475569" },
    };

    const colors = statusColor[coord.status] || statusColor.pendente_aprovacao;

    return (
      <div style={cd}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{coord.nome || "—"}</p>
            <p style={{ margin: "2px 0", fontSize: 11, color: "#64748b" }}>{coord.email}</p>
            <p style={{ margin: "2px 0", fontSize: 11, color: "#64748b" }}>{coord.unidadeNome}</p>
            <p style={{ margin: "2px 0", fontSize: 11, color: "#94a3b8" }}>Matrícula: {coord.matricula || "—"}</p>
            {coord.dataCriacao && <p style={{ margin: "4px 0 0", fontSize: 10, color: "#94a3b8" }}>{new Date(coord.dataCriacao).toLocaleDateString("pt-BR")}</p>}
          </div>
          <Badge label={coord.status === "pendente_aprovacao" ? "Pendente" : coord.status === "aprovada" ? "Aprovada" : coord.status === "rejeitada" ? "Rejeitada" : "Desativada"} c={colors} />
        </div>

        {action && (
          <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
            {action.buttons.map((btn) => (
              <button key={btn.label} onClick={() => action.onAction(btn.action)} style={{ ...bs, flex: 1, fontSize: 12, color: btn.color || "#334155" }}>
                {btn.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <p style={{ color: "#64748b" }}>Carregando coordenadores...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Coordenadores</h2>
        <button
          onClick={() => {
            setModal("novoconvite");
            setForm({ motivo: "", observacoes: "" });
          }}
          style={bp}
        >
          + Gerar Convite
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
        {[
          { id: "pendentes", label: `Pendentes (${coordPendentes.length})` },
          { id: "aprovadas", label: `Aprovadas (${coordAprovadas.length})` },
          { id: "rejeitadas", label: `Rejeitadas (${coordRejeitadas.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              background: tab === t.id ? "#1e3a8a" : "#f1f5f9",
              color: tab === t.id ? "#fff" : "#374151",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 12,
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(360px,1fr))", gap: 10 }}>
        {tab === "pendentes" &&
          (coordPendentes.length === 0 ? (
            <div style={{ ...cd, textAlign: "center", padding: 40, gridColumn: "1 / -1" }}>
              <p style={{ color: "#94a3b8" }}>Nenhuma coordenadora pendente</p>
            </div>
          ) : (
            coordPendentes.map((coord) => (
              <CoordCard
                key={coord.uid}
                coord={coord}
                action={{
                  buttons: [
                    { label: "Aprovar", action: "aprovar" },
                    { label: "Rejeitar", action: "rejeitar", color: "#dc2626" },
                  ],
                  onAction: (action) => {
                    setSelectedCoord(coord);
                    setForm({ motivo: "", observacoes: "" });
                    setModal(action === "aprovar" ? "aprovar" : "rejeitar");
                  },
                }}
              />
            ))
          ))}

        {tab === "aprovadas" &&
          (coordAprovadas.length === 0 ? (
            <div style={{ ...cd, textAlign: "center", padding: 40, gridColumn: "1 / -1" }}>
              <p style={{ color: "#94a3b8" }}>Nenhuma coordenadora aprovada</p>
            </div>
          ) : (
            coordAprovadas.map((coord) => (
              <CoordCard
                key={coord.uid}
                coord={coord}
                action={{
                  buttons: [{ label: "Desativar", action: "desativar", color: "#dc2626" }],
                  onAction: () => {
                    setSelectedCoord(coord);
                    setForm({ motivo: "", observacoes: "" });
                    setModal("desativar");
                  },
                }}
              />
            ))
          ))}

        {tab === "rejeitadas" &&
          (coordRejeitadas.length === 0 ? (
            <div style={{ ...cd, textAlign: "center", padding: 40, gridColumn: "1 / -1" }}>
              <p style={{ color: "#94a3b8" }}>Nenhuma coordenadora rejeitada</p>
            </div>
          ) : (
            coordRejeitadas.map((coord) => <CoordCard key={coord.uid} coord={coord} action={null} />)
          ))}
      </div>

      {modal === "aprovar" && selectedCoord && (
        <Overlay onClose={() => setModal(null)}>
          <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700 }}>Aprovar Coordenadora</h2>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b" }}>
            Tem certeza que quer aprovar <strong>{selectedCoord.nome}</strong>?
          </p>

          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Observações (opcional)</label>
          <TArea
            initial={form.observacoes}
            onVal={(v) => setForm((prev) => ({ ...prev, observacoes: v }))}
            rows={3}
            placeholder="Ex: Validado com RH"
            style={{ ...inp, resize: "none" }}
          />

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button onClick={() => setModal(null)} style={{ ...bs, flex: 1 }}>
              Cancelar
            </button>
            <button onClick={handleAprovar} style={{ ...bp, flex: 1, background: "#16a34a" }}>
              Aprovar
            </button>
          </div>
        </Overlay>
      )}

      {modal === "rejeitar" && selectedCoord && (
        <Overlay onClose={() => setModal(null)}>
          <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700 }}>Rejeitar Coordenadora</h2>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b" }}>
            Você está rejeitando <strong>{selectedCoord.nome}</strong>
          </p>

          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Motivo da rejeição *</label>
          <TArea
            initial={form.motivo}
            onVal={(v) => setForm((prev) => ({ ...prev, motivo: v }))}
            rows={3}
            placeholder="Ex: Matrícula inválida, dados incompletos..."
            style={{ ...inp, resize: "none" }}
          />

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button onClick={() => setModal(null)} style={{ ...bs, flex: 1 }}>
              Cancelar
            </button>
            <button onClick={handleRejeitar} disabled={!form.motivo.trim()} style={{ ...bp, flex: 1, background: "#dc2626", opacity: form.motivo.trim() ? 1 : 0.6 }}>
              Rejeitar
            </button>
          </div>
        </Overlay>
      )}

      {modal === "desativar" && selectedCoord && (
        <Overlay onClose={() => setModal(null)}>
          <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700 }}>Desativar Coordenadora</h2>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b" }}>
            Você está desativando <strong>{selectedCoord.nome}</strong>. Ela não conseguirá mais acessar o sistema.
          </p>

          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Motivo (opcional)</label>
          <TArea
            initial={form.motivo}
            onVal={(v) => setForm((prev) => ({ ...prev, motivo: v }))}
            rows={3}
            placeholder="Ex: Desligamento, mudança de cargo..."
            style={{ ...inp, resize: "none" }}
          />

          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button onClick={() => setModal(null)} style={{ ...bs, flex: 1 }}>
              Cancelar
            </button>
            <button onClick={handleDesativar} style={{ ...bp, flex: 1, background: "#dc2626" }}>
              Desativar
            </button>
          </div>
        </Overlay>
      )}

      {modal === "novoconvite" && (
        <Overlay onClose={() => setModal(null)}>
          <h2 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700 }}>Gerar Novo Convite</h2>

          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Unidade *</label>
          <select value={novoConvite.unidadeId} onChange={(e) => setNovoConvite((prev) => ({ ...prev, unidadeId: e.target.value }))} style={inp}>
            <option value="">— Selecione uma unidade —</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>

          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, marginTop: 12 }}>Matrícula (opcional)</label>
          <TInput initial={novoConvite.matricula} onVal={(v) => setNovoConvite((prev) => ({ ...prev, matricula: v }))} placeholder="Deixe em branco para preencher depois" style={inp} />

          {linkGerado ? (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: 16, marginTop: 16 }}>
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#15803d" }}>Convite criado!</p>
              <p style={{ margin: 0, fontSize: 12, color: "#065f46", wordBreak: "break-all", fontFamily: "monospace" }}>{linkGerado.link}</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(linkGerado.link);
                  alert("Link copiado!");
                }}
                style={{ width: "100%", marginTop: 10, ...bs, fontSize: 12 }}
              >
                Copiar link
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
              <button onClick={() => setModal(null)} style={{ ...bs, flex: 1 }}>
                Cancelar
              </button>
              <button onClick={handleGerarConvite} style={{ ...bp, flex: 1 }}>
                Gerar
              </button>
            </div>
          )}
        </Overlay>
      )}
    </div>
  );
}
