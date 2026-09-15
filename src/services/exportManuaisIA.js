/**
 * Exporta itens manuais (nome, marca, fotos, unidade, local)
 * em PDF com fotos embutidas — pronto para uma IA analisar.
 */

import { getCategoryGroup } from "../constants/categories.js";
import {
  expandItensComInventariadosOrfaos,
  getItemEspecie,
  getItemFotos,
  getItemLabel,
  getItemMarca,
  isManualItem,
} from "../utils/nomeCorrecao.js";
import { getFoundEntry } from "../utils/patrimonioId.js";
import { getItemIdInterno } from "../app/helpers/appHelpers.js";
import { fetchLocaisForUnits } from "./locaisLoad.js";
import { loadJsPDF, photoSrcToJpegDataUrl } from "./features.js";

function cleanUnidade(nome) {
  return String(nome || "").replace(/^\d+[\d.]*\s*-\s*/, "").trim() || "—";
}

async function resolveLocalMap(rows, locais = []) {
  const localMap = new Map();
  for (const l of locais || []) {
    const id = l?.id || l?._id;
    if (id) localMap.set(id, l.nome || id);
  }
  const missing = [
    ...new Set(rows.map((r) => r.localId).filter((id) => id && id !== "sem-local" && !localMap.has(id))),
  ];
  if (missing.length) {
    try {
      const unitIds = [...new Set(rows.map((r) => r.unidadeId).filter(Boolean))];
      const fetched = await fetchLocaisForUnits(unitIds, { localIds: missing });
      for (const l of fetched || []) {
        const id = l?.id || l?._id;
        if (id && l.nome) localMap.set(id, l.nome);
      }
    } catch {}
  }
  return localMap;
}

/**
 * Monta linhas dos itens manuais inventariados para o pacote IA.
 */
export function buildPacoteManuaisParaIARows({
  todosItens = [],
  foundMap = {},
  unidades = [],
  somenteComFoto = true,
  categoria = null,
  unidadeId = null,
} = {}) {
  const itens = expandItensComInventariadosOrfaos(todosItens, foundMap);
  const unitName = (id) => {
    const u = (unidades || []).find((x) => x.id === id);
    return u?.nome || "";
  };

  const rows = [];
  for (const item of itens) {
    if (!isManualItem(item)) continue;
    const f = getFoundEntry(item.id, foundMap);
    if (!f) continue;
    if (unidadeId && unidadeId !== "todas" && item.unidadeId !== unidadeId && f.unidadeId !== unidadeId) {
      continue;
    }

    const fotos = getItemFotos(item.id, foundMap).filter(Boolean);
    if (somenteComFoto && fotos.length === 0) continue;

    const especie = getItemEspecie(item, foundMap);
    const cat = getCategoryGroup(especie);
    if (categoria && categoria !== "todas" && cat !== categoria) continue;

    const uid = f.unidadeId || item.unidadeId || "";
    const unidadeFull = f.unidadeNome || item.unidadeNome || unitName(uid) || "—";

    rows.push({
      id: String(item.id),
      idInterno: getItemIdInterno(item, f),
      nomeAtual: getItemLabel(item, foundMap) || "—",
      marca: getItemMarca(item, foundMap) || "—",
      especie,
      categoria: cat,
      unidadeId: uid,
      unidade: cleanUnidade(unidadeFull),
      unidadeFull,
      localId: f.localId || "",
      estado: f.estado || "—",
      situacao: f.situacao || "—",
      cor: f.cor || item.cor || "",
      fotos,
      qtdFotos: fotos.length,
    });
  }

  rows.sort((a, b) => {
    const u = a.unidade.localeCompare(b.unidade, "pt-BR");
    if (u !== 0) return u;
    const c = a.categoria.localeCompare(b.categoria, "pt-BR");
    if (c !== 0) return c;
    return a.nomeAtual.localeCompare(b.nomeAtual, "pt-BR");
  });

  return rows;
}

async function enrichWithLocais(rows, locais = []) {
  const localMap = await resolveLocalMap(rows, locais);
  return rows.map((r) => ({
    ...r,
    local: !r.localId || r.localId === "sem-local" ? "Sem local" : localMap.get(r.localId) || r.localId,
  }));
}

async function gerarPdfManuaisIA(rows, { tituloFiltro, onProgress } = {}) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const usableW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (need) => {
    if (y + need > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Capa / instruções
  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.text("Pacote SEMCAS — Itens manuais para IA", margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.text(`Filtro: ${tituloFiltro}`, margin, y);
  y += 5;
  doc.text(`Data: ${new Date().toLocaleString("pt-BR")}`, margin, y);
  y += 5;
  doc.text(`Total de itens: ${rows.length}`, margin, y);
  y += 10;

  doc.setFont(undefined, "bold");
  doc.text("Instrucoes para a IA", margin, y);
  y += 6;
  doc.setFont(undefined, "normal");
  doc.setFontSize(9);
  const instrucoes = [
    "Analise a FOTO de cada item junto com nome atual e marca.",
    "Sugira nome padronizado em portugues (3 a 12 palavras).",
    "Inclua material, cor e atributos visiveis. Sem abreviacoes (c/, s/).",
    "Nao inclua marca, tombo, unidade ou local no nome.",
    "Especie em MAIUSCULAS (CADEIRA, MESA, ARMARIO...).",
    'Responda com JSON: [{"idInterno":"uuid...","id":"MAN_...","nomeSugerido":"...","especie":"CADEIRA"}]',
    "Prefira idInterno (UUID estavel) para identificar o item; id/patrimonio pode ser S/T.",
  ];
  for (const line of instrucoes) {
    ensureSpace(6);
    const wrapped = doc.splitTextToSize(`• ${line}`, usableW);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 4.2 + 1;
  }
  y += 6;

  const photoH = 42;
  const photoW = 56;
  const maxFotos = 2;
  const textBlockH = 32;
  const blockH = textBlockH + photoH + 6;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    onProgress?.({ done: i, total: rows.length, label: row.id });
    ensureSpace(blockH);

    doc.setDrawColor(220);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y - 2, usableW, blockH - 2, 2, 2, "FD");

    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    doc.setTextColor(19, 81, 180);
    doc.text(`${i + 1}. ${String(row.id).slice(0, 42)}`, margin + 3, y + 4);
    doc.setTextColor(0);
    doc.setFont(undefined, "normal");
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(String(row.categoria).slice(0, 24), margin + usableW - 3, y + 4, { align: "right" });
    doc.setTextColor(0);

    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`ID interno: ${String(row.idInterno || "—").slice(0, 44)}`, margin + 3, y + 8);
    doc.setTextColor(0);

    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    const nomeLines = doc.splitTextToSize(`Nome: ${String(row.nomeAtual).slice(0, 120)}`, usableW - 6);
    doc.text(nomeLines.slice(0, 1), margin + 3, y + 12.5);
    doc.setFont(undefined, "normal");
    doc.setFontSize(8);
    doc.text(`Marca: ${String(row.marca).slice(0, 40)}  ·  Especie: ${String(row.especie).slice(0, 24)}`, margin + 3, y + 17);
    doc.text(`Unidade: ${String(row.unidade).slice(0, 48)}`, margin + 3, y + 21);
    doc.text(
      `Local: ${String(row.local || "Sem local").slice(0, 40)}${row.cor ? `  ·  Cor: ${String(row.cor).slice(0, 16)}` : ""}  ·  Estado: ${String(row.estado).slice(0, 12)}`,
      margin + 3,
      y + 25
    );

    const imgY = y + textBlockH;
    const fotos = (row.fotos || []).slice(0, maxFotos);
    if (fotos.length === 0) {
      doc.setTextColor(150);
      doc.text("Sem foto", margin + 6, imgY + photoH / 2);
      doc.setTextColor(0);
    } else {
      for (let fi = 0; fi < fotos.length; fi++) {
        const dataUrl = await photoSrcToJpegDataUrl(fotos[fi], 480, 360, 0.7);
        const x = margin + 3 + fi * (photoW + 4);
        if (dataUrl && dataUrl.startsWith("data:image")) {
          try {
            const fmt = /data:image\/png/i.test(dataUrl) ? "PNG" : "JPEG";
            doc.addImage(dataUrl, fmt, x, imgY, photoW, photoH);
          } catch {
            doc.setTextColor(150);
            doc.text("Foto indisponivel", x + 2, imgY + photoH / 2);
            doc.setTextColor(0);
          }
        } else {
          doc.setTextColor(150);
          doc.text("Foto indisponivel", x + 2, imgY + photoH / 2);
          doc.setTextColor(0);
        }
      }
    }

    y += blockH;
  }

  onProgress?.({ done: rows.length, total: rows.length, label: "Concluído" });
  return doc;
}

/** Gera e baixa PDF com fotos embutidas dos itens manuais. */
export async function gerarPacoteManuaisParaIA({
  todosItens = [],
  foundMap = {},
  unidades = [],
  locais = [],
  somenteComFoto = true,
  categoria = null,
  unidadeId = null,
  onProgress,
} = {}) {
  onProgress?.({ phase: "montar", label: "Montando lista…" });
  const raw = buildPacoteManuaisParaIARows({
    todosItens,
    foundMap,
    unidades,
    somenteComFoto,
    categoria,
    unidadeId,
  });

  if (raw.length === 0) {
    throw new Error(
      somenteComFoto
        ? "Nenhum item manual com foto encontrado."
        : "Nenhum item manual encontrado."
    );
  }

  onProgress?.({ phase: "locais", label: "Resolvendo locais…" });
  const rows = await enrichWithLocais(raw, locais);

  const stamp = new Date().toISOString().slice(0, 10);
  const tituloFiltro = [
    "Itens manuais",
    somenteComFoto ? "com foto" : "com ou sem foto",
    categoria && categoria !== "todas" ? `categoria ${categoria}` : null,
    unidadeId && unidadeId !== "todas" ? "unidade filtrada" : "todas as unidades",
  ]
    .filter(Boolean)
    .join(" · ");

  onProgress?.({ phase: "pdf", label: "Gerando PDF com fotos…" });
  const doc = await gerarPdfManuaisIA(rows, {
    tituloFiltro,
    onProgress: (p) => onProgress?.({ phase: "pdf", ...p }),
  });

  const slug =
    categoria && categoria !== "todas"
      ? String(categoria).toLowerCase().replace(/\W+/g, "_").slice(0, 20)
      : "manuais";
  const filename = `pacote_manuais_ia_${slug}_${stamp}.pdf`;

  // Preview local no navegador (blob:) + download do arquivo
  const blob = doc.output("blob");
  const previewUrl = URL.createObjectURL(blob);
  const opened = window.open(previewUrl, "_blank", "noopener,noreferrer");
  if (!opened) {
    // Popup bloqueado → só baixa
    doc.save(filename);
  } else {
    doc.save(filename);
    setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
  }

  onProgress?.({ phase: "done", label: "Concluído", total: rows.length });
  return { count: rows.length, rows, previewUrl: opened ? previewUrl : null };
}
