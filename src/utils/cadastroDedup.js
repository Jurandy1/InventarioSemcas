import { normalizeMatchText, textSimilarity } from "./ajusteMatch.js";

/** E-mail normalizado (Gmail: ignora pontos e alias +). */
export function normalizeCadastroEmail(email) {
  const raw = String(email || "").trim().toLowerCase();
  const at = raw.indexOf("@");
  if (at < 0) return raw;

  let local = raw.slice(0, at);
  let domain = raw.slice(at + 1);
  local = local.split("+")[0];

  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");

  return `${local}@${domain}`;
}

/** Matrícula só com dígitos; se vazio, mantém texto limpo em maiúsculas. */
export function normalizeCadastroMatricula(matricula) {
  const raw = String(matricula || "").trim();
  const digits = raw.replace(/\D/g, "");
  return digits || raw.toUpperCase();
}

export function cadastroEmailDocId(email) {
  const norm = normalizeCadastroEmail(email);
  const safe = norm.replace(/[^a-z0-9@._-]/g, "_");
  return `email_${safe}`;
}

export function cadastroMatriculaDocId(matricula) {
  const norm = normalizeCadastroMatricula(matricula);
  if (!norm) return null;
  return `mat_${norm.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

export function cadastroNomeDocId(nome) {
  const slug = normalizeMatchText(nome).replace(/\s+/g, "_").slice(0, 80);
  return slug ? `nome_${slug}` : null;
}

export function isCadastroStatusAtivo(status) {
  const s = String(status || "").toLowerCase();
  return !["rejeitado", "rejeitada", "desativado", "desativada"].includes(s);
}

const PAPEL_LABEL = {
  inventariante: "inventariante",
  coordenador: "coordenadora",
};

function statusLabel(status) {
  const s = String(status || "").toLowerCase();
  if (s === "aprovado" || s === "aprovada") return "aprovado";
  if (s === "pendente_aprovacao") return "pendente de aprovação";
  return s || "cadastrado";
}

export function montarMensagemDuplicata(hits, papelAtual) {
  if (!hits?.length) return "";

  const parts = [];
  for (const h of hits) {
    const quem = PAPEL_LABEL[h.papel] || h.papel || "usuário";
    const st = statusLabel(h.status);

    if (h.tipo === "email") {
      parts.push(`Este e-mail já está vinculado a um cadastro de ${quem} (${st}).`);
    } else if (h.tipo === "matricula") {
      parts.push(
        `Esta matrícula já pertence a ${h.nome || "outra pessoa"} (${quem}, ${st}).`
      );
    } else if (h.tipo === "nome") {
      parts.push(`Já existe cadastro com o mesmo nome (${h.nome}, matrícula ${h.matricula || "—"}).`);
    } else if (h.tipo === "nome_similar") {
      parts.push(
        `Nome muito parecido com ${h.nome} (matrícula ${h.matricula || "—"}, ${quem}). Verifique se não é cadastro duplicado.`
      );
    }
  }

  if (papelAtual && hits.some((h) => h.papel && h.papel !== papelAtual)) {
    parts.push("O mesmo servidor não pode se cadastrar como inventariante e coordenadora com dados repetidos.");
  }

  return parts.join(" ");
}

/** Analisa índice local (lista admin) para duplicatas entre pendentes. */
export function acharDuplicatasNaLista(usuarios) {
  const byEmail = new Map();
  const byMat = new Map();
  const flags = new Map();

  for (const u of usuarios || []) {
    const uid = u.uid || u._id;
    if (!uid) continue;

    const emailKey = normalizeCadastroEmail(u.email);
    if (emailKey) {
      const prev = byEmail.get(emailKey);
      if (prev) {
        flags.set(uid, "E-mail duplicado na fila");
        flags.set(prev.uid || prev._id, "E-mail duplicado na fila");
      } else {
        byEmail.set(emailKey, u);
      }
    }

    const matKey = normalizeCadastroMatricula(u.matricula);
    if (matKey) {
      const prev = byMat.get(matKey);
      if (prev) {
        flags.set(uid, flags.get(uid) || "Matrícula duplicada na fila");
        flags.set(prev.uid || prev._id, "Matrícula duplicada na fila");
      } else {
        byMat.set(matKey, u);
      }
    }
  }

  return flags;
}

export function avaliarNomeSimilar(nomeNovo, registroIndice) {
  if (!nomeNovo?.trim() || !registroIndice?.nome) return null;
  const normNovo = normalizeMatchText(nomeNovo);
  const normExistente = normalizeMatchText(registroIndice.nome);
  if (!normNovo || !normExistente) return null;
  if (normNovo === normExistente) return { tipo: "nome", similaridade: 1 };
  const sim = textSimilarity(nomeNovo, registroIndice.nome);
  if (sim >= 0.85) return { tipo: "nome_similar", similaridade: sim };
  return null;
}
