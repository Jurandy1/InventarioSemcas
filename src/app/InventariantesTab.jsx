import React, { useEffect, useState } from "react";
import { Badge } from "../components/Badge.jsx";
import { TArea, TInput } from "../components/FormFields.jsx";
import {
  obterInventariantes,
  aprovarInventariante,
  rejeitarInventariante,
  desativarInventariante,
  gerarLinkConviteInventariante,
} from "../services/firebase.js";

export function InventariantesTab({ showT, isMob }) {
  const [pendentes, setPendentes] = useState([]);
  const [aprovados, setAprovados] = useState([]);
  const [rejeitados, setRejeitados] = useState([]);
  const [desativados, setDesativados] = useState([]);
  const [tab, setTab] = useState("pendentes");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ motivo: "", observacoes: "" });
  const [linkGerado, setLinkGerado] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const [p, a, r, d] = await Promise.all([
        obterInventariantes("pendente_aprovacao"),
        obterInventariantes("aprovado"),
        obterInventariantes("rejeitado"),
        obterInventariantes("desativado"),
      ]);
      setPendentes(p);
      setAprovados(a);
      setRejeitados(r);
      setDesativados(d);
    } catch (e) {
      console.error(e);
      showT("Erro ao carregar inventariantes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const handleAprovar = async () => {
    if (!selected) return;
    try {
      await aprovarInventariante(selected.uid, form.observacoes);
      showT("✓ Inventariante aprovado!");
      setModal(null);
      carregar();
    } catch (e) { showT("Erro: " + e.message); }
  };

  const handleRejeitar = async () => {
    if (!selected || !form.motivo.trim()) return;
    try {
      await rejeitarInventariante(selected.uid, form.motivo);
      showT("✓ Inventariante rejeitado");
      setModal(null);
      carregar();
    } catch (e) { showT("Erro: " + e.message); }
  };

  const handleDesativar = async () => {
    if (!selected) return;
    try {
      await desativarInventariante(selected.uid, form.motivo);
      showT("✓ Inventariante desativado");
      setModal(null);
      carregar();
    } catch (e) { showT("Erro: " + e.message); }
  };

  const handleGerarConvite = async () => {
    setGerando(true);
    try {
      const { convite, link } = await gerarLinkConviteInventariante();
      setLinkGerado({ convite, link });
    } catch (e) {
      showT("Erro ao gerar convite: " + e.message);
    } finally {
      setGerando(false);
    }
  };

  const copiarLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      showT("✓ Link copiado!");
    } catch {
      showT("Selecione e copie manualmente: " + link);
    }
  };

  const inp = {
    width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9,
    padding: "10px 13px", fontSize: 14, fontFamily: "inherit",
    boxSizing: "border-box", outline: "none",
  };
  const bp = { background: "#1e3a8a", color: "#fff", border: "none", borderRadius: 9, padding: "11px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" };
  const bs = { background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 9, padding: "11px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
  const cd = { background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,.06)" };

  const statusColor = {
    pendente_aprovacao: { bg: "#fff7ed", tx: "#c2410c" },
    aprovado:           { bg: "#f0fdf4", tx: "#15803d" },
    rejeitado:          { bg: "#fee2e2", tx: "#b91c1c" },
    desativado:         { bg: "#f1f5f9", tx: "#475569" },
  };
  const statusLabel = {
    pendente_aprovacao: "Pendente",
    aprovado: "Aprovado",
    rejeitado: "Rejeitado",
    desativado: "Desativado",
  };

  const Overlay = ({ children, onClose }) => (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 300, display: "flex", alignItems: isMob ? "flex-end" : "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: isMob ? "20px 20px 0 0" : 16, width: isMob ? "100%" : "520px", maxHeight: isMob ? "90dvh" : "85vh", overflowY: "auto", padding: 24, paddingBottom: isMob ? "calc(24px + env(safe-area-inset-bottom,0px))" : 24 }}
      >
        {children}
      </div>
    </div>
  );

  const InvCard = ({ inv, actions }) => (
    <div style={{ ...cd, border: `1.5px solid ${statusColor[inv.status]?.bg || "#e2e8f0"}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{inv.nome || "—"}</p>
          <p style={{ margin: "2px 0", fontSize: 11, color: "#64748b" }}>📧 {inv.email}</p>
          {inv.matricula && <p style={{ margin: "2px 0", fontSize: 11, color: "#64748b" }}>🪪 Matrícula: {inv.matricula}</p>}
          {inv.cargo && <p style={{ margin: "2px 0", fontSize: 11, color: "#64748b" }}>💼 {inv.cargo}</p>}
          {inv.dataCriacao && (
            <p style={{ margin: "4px 0 0", fontSize: 10, color: "#94a3b8" }}>
              Cadastro: {new Date(inv.dataCriacao).toLocaleDateString("pt-BR")}
            </p>
          )}
          {inv.status === "rejeitado" && inv.motivoRejeicao && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#dc2626", fontWeight: 600 }}>
              Motivo: {inv.motivoRejeicao}
            </p>
          )}
          {inv.status === "desativado" && inv.motivoDesativacao && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>
              Motivo: {inv.motivoDesativacao}
            </p>
          )}
        </div>
        <Badge label={statusLabel[inv.status] || inv.status} c={statusColor[inv.status]} />
      </div>
      {actions && (
        <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
          {actions.map((btn) => (
            <button
              key={btn.label}
              onClick={() => btn.onClick()}
              style={{ ...bs, flex: 1, fontSize: 12, padding: "8px 12px", color: btn.danger ? "#dc2626" : "#334155" }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const tabs = [
    { id: "pendentes",  label: `⏳ Pendentes (${pendentes.length})` },
    { id: "aprovados",  label: `✅ Aprovados (${aprovados.length})` },
    { id: "rejeitados", label: `❌ Rejeitados (${rejeitados.length})` },
    { id: "desativados",label: `🚫 Desativados (${desativados.length})` },
  ];

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: "#64748b", fontSize: 13 }}>Carregando inventariantes...</p>
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>👷 Inventariantes</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
            Gerencie quem pode acessar o sistema de inventário
          </p>
        </div>
        <button onClick={() => { setLinkGerado(null); setModal("convite"); }} style={bp}>
          🔗 Gerar Convite
        </button>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: tab === t.id ? "#1e3a8a" : "#f1f5f9", color: tab === t.id ? "#fff" : "#374151", fontWeight: 600, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Lists ── */}
      <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(360px,1fr))", gap: 10 }}>
        {tab === "pendentes" && (
          pendentes.length === 0
            ? <Empty icon="✅" msg="Nenhum inventariante aguardando aprovação" />
            : pendentes.map((inv) => (
                <InvCard key={inv.uid || inv._id} inv={inv} actions={[
                  { label: "✓ Aprovar", onClick: () => { setSelected(inv); setForm({ motivo: "", observacoes: "" }); setModal("aprovar"); } },
                  { label: "✕ Rejeitar", danger: true, onClick: () => { setSelected(inv); setForm({ motivo: "", observacoes: "" }); setModal("rejeitar"); } },
                ]} />
              ))
        )}
        {tab === "aprovados" && (
          aprovados.length === 0
            ? <Empty icon="👤" msg="Nenhum inventariante aprovado ainda" />
            : aprovados.map((inv) => (
                <InvCard key={inv.uid || inv._id} inv={inv} actions={[
                  { label: "🚫 Desativar", danger: true, onClick: () => { setSelected(inv); setForm({ motivo: "", observacoes: "" }); setModal("desativar"); } },
                ]} />
              ))
        )}
        {tab === "rejeitados" && (
          rejeitados.length === 0
            ? <Empty icon="📋" msg="Nenhum inventariante rejeitado" />
            : rejeitados.map((inv) => (
                <InvCard key={inv.uid || inv._id} inv={inv} actions={[
                  { label: "✓ Aprovar mesmo assim", onClick: () => { setSelected(inv); setForm({ motivo: "", observacoes: "" }); setModal("aprovar"); } },
                ]} />
              ))
        )}
        {tab === "desativados" && (
          desativados.length === 0
            ? <Empty icon="💤" msg="Nenhum inventariante desativado" />
            : desativados.map((inv) => (
                <InvCard key={inv.uid || inv._id} inv={inv} actions={[
                  { label: "✓ Reativar", onClick: () => { setSelected(inv); setForm({ motivo: "", observacoes: "" }); setModal("aprovar"); } },
                ]} />
              ))
        )}
      </div>

      {/* ── Modal: Gerar Convite ── */}
      {modal === "convite" && (
        <Overlay onClose={() => setModal(null)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>🔗 Gerar Convite</h2>
            <button onClick={() => setModal(null)} style={{ background: "none", border: "none", fontSize: 20, color: "#64748b", cursor: "pointer" }}>✕</button>
          </div>

          <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#0369a1", lineHeight: 1.5 }}>
              O link gerado expira em <strong>7 dias</strong>. Quem acessar poderá criar uma conta
              e ficará como <strong>pendente de aprovação</strong> até você aprovar aqui nessa tela.
            </p>
          </div>

          {!linkGerado ? (
            <button
              onClick={handleGerarConvite}
              disabled={gerando}
              style={{ ...bp, width: "100%", opacity: gerando ? 0.7 : 1 }}
            >
              {gerando ? "⏳ Gerando..." : "🔗 Gerar Link de Convite"}
            </button>
          ) : (
            <div style={{ background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 12, padding: 16 }}>
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 800, color: "#15803d" }}>✅ Link gerado!</p>
              <p style={{ margin: "0 0 10px", fontSize: 10, color: "#64748b" }}>
                Válido até: {new Date(linkGerado.convite.dataExpiracao).toLocaleDateString("pt-BR")}
              </p>
              <div style={{ background: "#fff", border: "1px solid #d1fae5", borderRadius: 8, padding: "10px 12px", marginBottom: 10, wordBreak: "break-all", fontSize: 12, fontFamily: "monospace", color: "#064e3b" }}>
                {linkGerado.link}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => copiarLink(linkGerado.link)}
                  style={{ ...bp, flex: 1, fontSize: 13, background: copiado ? "#16a34a" : "#1e3a8a" }}
                >
                  {copiado ? "✓ Copiado!" : "📋 Copiar Link"}
                </button>
                <button
                  onClick={() => { setLinkGerado(null); }}
                  style={{ ...bs, fontSize: 13, padding: "11px 16px" }}
                >
                  Novo
                </button>
              </div>
              <p style={{ margin: "12px 0 0", fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>
                Envie este link para o inventariante por WhatsApp, e-mail ou outro canal seguro.
                Após o cadastro, a solicitação aparecerá na aba "Pendentes".
              </p>
            </div>
          )}
        </Overlay>
      )}

      {/* ── Modal: Aprovar ── */}
      {modal === "aprovar" && selected && (
        <Overlay onClose={() => setModal(null)}>
          <h2 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700 }}>✓ Aprovar Inventariante</h2>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b" }}>
            Você está aprovando <strong>{selected.nome}</strong> ({selected.email}).
            Após aprovação, este usuário poderá fazer login e inventariar normalmente.
          </p>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
            Observações (opcional)
          </label>
          <TArea
            initial={form.observacoes}
            onVal={(v) => setForm((p) => ({ ...p, observacoes: v }))}
            rows={3}
            placeholder="Ex: Aprovado após verificação com RH..."
            style={{ ...inp, resize: "none" }}
          />
          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button onClick={() => setModal(null)} style={{ ...bs, flex: 1 }}>Cancelar</button>
            <button onClick={handleAprovar} style={{ ...bp, flex: 1, background: "#16a34a" }}>✓ Confirmar Aprovação</button>
          </div>
        </Overlay>
      )}

      {/* ── Modal: Rejeitar ── */}
      {modal === "rejeitar" && selected && (
        <Overlay onClose={() => setModal(null)}>
          <h2 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700 }}>✕ Rejeitar Inventariante</h2>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b" }}>
            Você está rejeitando <strong>{selected.nome}</strong> ({selected.email}).
            O usuário não conseguirá fazer login.
          </p>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
            Motivo da rejeição <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <TArea
            initial={form.motivo}
            onVal={(v) => setForm((p) => ({ ...p, motivo: v }))}
            rows={3}
            placeholder="Ex: Matrícula inválida, usuário não reconhecido..."
            style={{ ...inp, resize: "none" }}
          />
          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button onClick={() => setModal(null)} style={{ ...bs, flex: 1 }}>Cancelar</button>
            <button
              onClick={handleRejeitar}
              disabled={!form.motivo.trim()}
              style={{ ...bp, flex: 1, background: "#dc2626", opacity: form.motivo.trim() ? 1 : 0.6 }}
            >
              ✕ Confirmar Rejeição
            </button>
          </div>
        </Overlay>
      )}

      {/* ── Modal: Desativar ── */}
      {modal === "desativar" && selected && (
        <Overlay onClose={() => setModal(null)}>
          <h2 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700 }}>🚫 Desativar Inventariante</h2>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b" }}>
            Você está desativando <strong>{selected.nome}</strong>. O acesso ao sistema será bloqueado imediatamente.
          </p>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
            Motivo (opcional)
          </label>
          <TArea
            initial={form.motivo}
            onVal={(v) => setForm((p) => ({ ...p, motivo: v }))}
            rows={3}
            placeholder="Ex: Desligamento, mudança de equipe..."
            style={{ ...inp, resize: "none" }}
          />
          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button onClick={() => setModal(null)} style={{ ...bs, flex: 1 }}>Cancelar</button>
            <button onClick={handleDesativar} style={{ ...bp, flex: 1, background: "#dc2626" }}>🚫 Desativar</button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function Empty({ icon, msg }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 40, textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,.06)", gridColumn: "1 / -1" }}>
      <p style={{ fontSize: 40, margin: "0 0 8px" }}>{icon}</p>
      <p style={{ color: "#94a3b8", margin: 0, fontSize: 13 }}>{msg}</p>
    </div>
  );
}
