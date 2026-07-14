import React from "react";
import { fsDel, fsGetDoc, fsSet } from "../../services/firebase.js";
import { uploadPhotos, isStorageOk } from "../../services/storage.js";
import { generateQRCode } from "../../services/qr-service.js";
import { criarBackupManual, logAuditoria } from "../../services/audit.js";
import { EVENTOS, gerarRelatorioExcel, gerarRelatorioPDF, notificationService, queueOfflineWithPhotos } from "../../services/features.js";
import { compressPhotoArray, bumpCacheBuster, setCachedData } from "../../utils/performance.js";
import { buildDoacaoOrigemExtras, defaultEstadoForItem, inferEspecieFromDesc } from "../../utils/itemHelpers.js";
import { isSemTomboItem } from "../../utils/semTombo.js";
import { getFoundEntry, isItemInventariado, normalizePatrimonioId } from "../../utils/patrimonioId.js";
import { resolveUnitForItem } from "../../utils/inventorySession.js";
import { getTeamMemberEditingItem } from "../../utils/inventoryPresence.js";
import { rankTombosForAjuste } from "../../utils/ajusteMatch.js";
import { buildFinalizacaoStats, criarFinalizacao, atualizarStatsFinalizacao } from "../../services/finalizacoes.js";
import { buildManualPatrimonio } from "../helpers/appHelpers.js";
import { isManualItem } from "../../utils/nomeCorrecao.js";
import { clearUiResume } from "../../utils/uiResume.js";

export function useAppItemActions({ state, data }) {
  const {
    formRef, finalizadoEdit, setFinalizadoEdit, finalizandoRef,
    busy, setBusy, setModal, setQrCodeUrl, setCoordRegistroLink,
    hideIncorporados, multiRowsPhotosRef, showT, getField, bumpFt,
    teamOnline,
  } = state;
  const {
    assertPodeEditar, auth, found, inventario, unidadeAtiva, unidades, setUnidades,
    editScopeUnits, scopeAllItens, sessionLocais, sugestoes, updateQueueStatus,
    finalizacoesState, todosItens,
  } = data;

  const aplicarCorrecaoNomes = React.useCallback(
    async (payload) => {
      if (!assertPodeEditar()) return;
      const batches = Array.isArray(payload) ? payload : [payload];
      const patches = new Map();

      for (const batch of batches) {
        const desc = String(batch?.descricao || "").trim();
        const esp = String(batch?.especie || "").trim();
        if (!desc) continue;
        for (const id of batch?.targetIds || []) {
          if (!id) continue;
          const item = todosItens.find((i) => i.id === id);
          if (!item) continue;
          patches.set(id, { desc, esp, item });
        }
      }
      if (!patches.size) return;

      setBusy(true);
      try {
        const now = new Date().toISOString();
        let total = 0;

        for (const [id, { desc, esp, item }] of patches) {
          const f = getFoundEntry(id, found.foundMap);
          const antes = {
            descricao: f?.descricaoEdit || item.descricao,
            especie: f?.especieEdit || item.especie,
          };
          if (isManualItem(item)) {
            await fsSet("manuais", id, {
              ...item,
              descricao: desc,
              especie: esp,
              unidadeId: item.unidadeId,
            });
          }
          if (f) {
            const invId = f.patrimonioId || f._id || normalizePatrimonioId(id);
            await fsSet("inventario", invId, {
              ...f,
              patrimonioId: invId,
              descricaoEdit: desc,
              especieEdit: esp,
              ultimaAtualizacao: now,
              usuario: auth.logado?.nome || "",
              email: auth.logado?.email || "",
            });
          }
          await logAuditoria(
            "rename",
            isManualItem(item) ? "manuais" : "inventario",
            id,
            antes,
            { descricao: desc, especie: esp }
          );
          total++;
        }

        const idSet = new Set(patches.keys());
        const idSetNorm = new Set([...patches.keys()].map((id) => normalizePatrimonioId(id)));
        const patchItem = (it) => {
          const p = patches.get(it.id);
          if (!p) return it;
          if (isManualItem(it)) return { ...it, descricao: p.desc, especie: p.esp };
          return it;
        };
        setUnidades((prev) => prev.map((u) => ({ ...u, itens: u.itens.map(patchItem) })));
        inventario.setUnidadesAtivas((prev) => prev.map((u) => ({ ...u, itens: u.itens.map(patchItem) })));

        const nextFound = (found.foundRef.current || []).map((f) => {
          const pid = f.patrimonioId || f._id;
          if (!idSet.has(pid) && !idSetNorm.has(normalizePatrimonioId(pid))) return f;
          const p =
            patches.get(pid) ||
            [...patches.entries()].find(([k]) => normalizePatrimonioId(k) === normalizePatrimonioId(pid))?.[1];
          if (!p) return f;
          return { ...f, descricaoEdit: p.desc, especieEdit: p.esp, ultimaAtualizacao: now };
        });
        found.syncFoundRef(nextFound);
        await setCachedData("inventario", nextFound);
        bumpCacheBuster();
        showT(`Nomes padronizados: ${total} item(ns)`);
      } catch (e) {
        showT("Erro ao corrigir nomes: " + (e?.message || e));
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [assertPodeEditar, todosItens, found, auth.logado, inventario, setUnidades, showT, setBusy]
  );

  const lookupTombo = React.useCallback(
    (raw) => {
      const alvo = normalizePatrimonioId(raw);
      if (!alvo || /^(ST_|MAN_)/i.test(alvo)) return null;
      for (const u of unidades) {
        for (const i of u.itens) {
          if (
            normalizePatrimonioId(i.id) === alvo ||
            (i.patrimonioLabel && normalizePatrimonioId(i.patrimonioLabel) === alvo)
          ) {
            const f = getFoundEntry(i.id, found.foundMap);
            return {
              item: { ...i, unidadeId: u.id, unidadeNome: u.nome },
              inventariado: !!f,
              foundBy: f?.usuario || f?.user || "",
              outraUnidade: unidadeAtiva ? u.id !== unidadeAtiva.id : false,
            };
          }
        }
      }
      return null;
    },
    [unidades, found.foundMap, unidadeAtiva]
  );

  /** Coleta rápida: Local Atual + defaults, sem abrir o formulário completo. */
  const quickMarkFound = React.useCallback(
    async (item) => {
      if (!assertPodeEditar()) return { ok: false, reason: "blocked" };
      if (!item?.id) return { ok: false, reason: "missing" };
      if (isItemInventariado(item.id, found.foundSet)) {
        showT("Item já coletado — toque no card para editar");
        return { ok: false, reason: "already", item };
      }
      const localId = String(inventario.activeLocalId || "").trim();
      if (!localId) {
        showT("Fixe o Local Atual antes de usar Encontrei");
        return { ok: false, reason: "no-local" };
      }
      const myUid = auth.logado?.uid || "";
      const reservedBy = getTeamMemberEditingItem(teamOnline, item.id, myUid);
      if (reservedBy) {
        const ok = window.confirm(`${reservedBy.nome} está neste item. Coletar mesmo assim?`);
        if (!ok) return { ok: false, reason: "reserved" };
      }
      const unit = resolveUnitForItem(item, inventario.unidadesAtivas, unidadeAtiva);
      const estado = defaultEstadoForItem(item);
      const situacao = item.tipoEntrada === "Permuta" ? "Permuta" : "Em uso";
      const origem = item.tipoEntrada === "Permuta" ? "Permuta" : item.tipoEntrada || "Próprio";
      try {
        await found.markFound({
          itemId: item.id,
          estado,
          situacao,
          localId,
          obs: "",
          marca: item.marca || "",
          origem,
          fotoUrls: [],
          unidadeAtiva: unit,
          itemUnit: unit,
          logado: auth.logado,
          updateQueueStatus,
        });
        const localNome = (sessionLocais || []).find((l) => l.id === localId)?.nome || "sala";
        showT(`Coletado · ${localNome}`);
        notificationService.notify(EVENTOS.ITEM_ENCONTRADO, { message: "Item coletado", type: "success" });
        return { ok: true };
      } catch (e) {
        showT("Erro ao coletar: " + (e?.message || e));
        return { ok: false, reason: "error" };
      }
    },
    [
      assertPodeEditar,
      found,
      inventario.activeLocalId,
      inventario.unidadesAtivas,
      unidadeAtiva,
      auth.logado,
      teamOnline,
      sessionLocais,
      updateQueueStatus,
      showT,
    ]
  );

  // Quando um finalizado está aberto para edição, itens novos precisam entrar
  // no snapshot finalizadoEdit.units (senão só aparecem ao reabrir) e as
  // estatísticas do registro de finalização precisam ser recalculadas.
  const appendItemsToFinalizadoScope = (unitId, items) => {
    if (!finalizadoEdit?.fin || !items?.length) return;
    const units = finalizadoEdit.units.map((u) =>
      u.id === unitId ? { ...u, itens: [...u.itens, ...items] } : u
    );
    setFinalizadoEdit({ ...finalizadoEdit, units });
    if (finalizadoEdit.fin.id && !finalizadoEdit.fin.legacy) {
      const nextFoundSet = new Set([...found.foundSet, ...items.map((i) => i.id)]);
      atualizarStatsFinalizacao(finalizadoEdit.fin.id, buildFinalizacaoStats(units, nextFoundSet))
        .then(() => finalizacoesState.refresh?.())
        .catch(() => {});
    }
  };

  const addManual = async () => {
    if (!assertPodeEditar()) return;
    const desc = getField("manDesc");
    if (!desc.trim()) {
      showT("Descrição obrigatória");
      return;
    }
    if (!unidadeAtiva) {
      showT("Selecione uma unidade");
      return;
    }
    const qty = Math.max(1, Math.min(50, Math.floor(Number(formRef.current.manQtd || 1) || 1)));
    const sharePhotos = formRef.current.manSharePhotos !== false;

    const manualPatrimonioRaw = String(getField("manPatrimonio") || "").trim();
    const manualPatrimonio = buildManualPatrimonio(manualPatrimonioRaw);

    if (qty > 1 && !sharePhotos) {
      showT("Para fotos diferentes, cadastre um item por vez");
      return;
    }

    if (qty > 1 && manualPatrimonioRaw && manualPatrimonio.patrimonioLabel !== "S/T") {
      showT("Para patrimônio informado, use quantidade 1");
      return;
    }

    const manImei = String(getField("manImei") || "").trim();
    if (manImei && qty > 1) {
      showT("IMEI é único por aparelho — cadastre um item por vez");
      return;
    }

    // Tombo digitado já existe em alguma unidade da base? Avisa antes de duplicar.
    if (manualPatrimonioRaw && manualPatrimonio.patrimonioLabel !== "S/T") {
      const hit = lookupTombo(manualPatrimonioRaw);
      if (hit) {
        const unidadeHit = String(hit.item.unidadeNome || "").replace(/^\d+[\d.]*\s*-\s*/, "");
        const msg = hit.inventariado
          ? `O tombo ${manualPatrimonioRaw} JÁ FOI INVENTARIADO (${unidadeHit}${hit.foundBy ? `, por ${hit.foundBy}` : ""}).\n\nCriar um item manual duplicado mesmo assim?`
          : `O tombo ${manualPatrimonioRaw} já existe na planilha da unidade "${unidadeHit}".\n\nO recomendado é abrir o item da planilha (botão no aviso amarelo). Criar um item manual mesmo assim?`;
        if (!window.confirm(msg)) return;
      }
    }

    const baseNow = Date.now();
    const existingIds = new Set((unidadeAtiva?.itens || []).map((i) => i.id));

    const makeId = (kind, i) => {
      const rand = Math.random().toString(36).slice(2, 7);
      return `${kind}_${baseNow}_${rand}_${i + 1}`;
    };

    const kind = manualPatrimonio.patrimonioLabel === "S/T" ? "ST" : manualPatrimonioRaw ? "MAN" : "MAN";

    const ids = [];
    if (qty === 1) {
      const id = manualPatrimonio.id;
      // IDs MAN_ são sempre únicos (baseados em Date.now + rand), sem risco de duplicata
      if (!id.startsWith("MAN_") && !id.startsWith("ST_") && existingIds.has(id)) {
        showT("Já existe um item com esse patrimônio nesta unidade");
        return;
      }
      ids.push(id);
    } else {
      for (let i = 0; i < qty; i++) {
        let candidate = makeId(kind, i);
        while (existingIds.has(candidate) || ids.includes(candidate)) candidate = makeId(kind, i);
        ids.push(candidate);
      }
    }

    const baseItem = {
      patrimonioLabel: manualPatrimonio.patrimonioLabel,
      ...(manualPatrimonio.tomboRef ? { tomboRef: manualPatrimonio.tomboRef } : {}),
      data: new Date().toLocaleDateString("pt-BR"),
      especie: getField("manEspecie") || inferEspecieFromDesc(desc, sugestoes?.especies),
      descricao: desc.trim(),
      marca: getField("manMarca"),
      fornecedor: getField("manFornecedor"),
      empenho: "",
      nf: "",
      dataNF: "",
      valor: parseFloat(getField("manValor")) || 0,
      valorAtual: 0,
      isManual: true,
      ...(manImei ? { imei: manImei } : {}),
    };

    const newItems = ids.map((id) => ({ ...baseItem, id }));
    const manLocalId = getField("manLocal") || sessionLocais[0]?.id || "";
    const manEstado = getField("manEstado") || "Bom";
    const manSituacao = getField("manSituacao") || "Em uso";
    const manOrigem = getField("manOrigem") || "Próprio";
    const manMarca = getField("manMarca") || "";
    const manCor = String(getField("manCor") || "").trim();

    const doacaoExtras = {
      ...buildDoacaoOrigemExtras(getField, "man"),
      ...(manImei ? { imei: manImei } : {}),
      ...(manCor ? { cor: manCor } : {}),
    };

    const buildManualInvEntry = (it, urls = []) => {
      const now = new Date();
      return {
        patrimonioId: it.id,
        unidadeId: unidadeAtiva?.id || "",
        unidadeNome: unidadeAtiva?.nome || "",
        estado: manEstado,
        situacao: manSituacao,
        localId: manLocalId,
        obs: desc.trim(),
        marca: manMarca,
        origem: manOrigem,
        ...doacaoExtras,
        fotoUrls: urls,
        data: now.toLocaleDateString("pt-BR"),
        hora: now.toLocaleTimeString("pt-BR"),
        usuario: auth.logado?.nome || "",
        email: auth.logado?.email || "",
        ultimaAtualizacao: now.toISOString(),
        user: auth.logado?.nome || "",
        isManual: true,
      };
    };

    if (!navigator.onLine) {
      const steps = [];
      for (const it of newItems) {
        steps.push({ collection: "manuais", docId: it.id, content: { ...it, unidadeId: unidadeAtiva?.id } });
        steps.push({ collection: "inventario", docId: it.id, content: buildManualInvEntry(it), usePhotos: Boolean(formRef.current.manPhotos?.length) });
      }
      await queueOfflineWithPhotos({
        type: "batch",
        data: { steps, uploadPrefix: sharePhotos && qty > 1 ? `manual/${ids[0]}` : ids[0] },
        photos: formRef.current.manPhotos || [],
      });
      updateQueueStatus();
      const novaAtiva = { ...unidadeAtiva, itens: [...unidadeAtiva.itens, ...newItems] };
      inventario.setUnidadesAtivas((prev) => prev.map((u) => (u.id === novaAtiva.id ? novaAtiva : u)));
      setUnidades((prev) => prev.map((u) => (u.id === novaAtiva.id ? novaAtiva : u)));
      appendItemsToFinalizadoScope(novaAtiva.id, newItems);
      for (const it of newItems) {
        await found.markFound({
          itemId: it.id,
          estado: manEstado,
          situacao: manSituacao,
          localId: manLocalId,
          obs: desc.trim(),
          marca: manMarca,
          origem: manOrigem,
          extras: doacaoExtras,
          fotoUrls: [],
          unidadeAtiva,
          logado: auth.logado,
          localOnly: true,
          isManual: true,
        });
      }
      clearUiResume();
      setModal(null);
      showT(qty > 1 ? `${qty} itens na fila (offline)` : "Na fila (offline)");
      notificationService.notify(EVENTOS.ITEM_ENCONTRADO, { message: "Item enfileirado offline", type: "info" });
      return;
    }

    let fotoUrls = [];
    if (formRef.current.manPhotos?.length && isStorageOk()) {
      setBusy(true);
      try {
        const compressed = await compressPhotoArray(formRef.current.manPhotos);
        const uploadPrefix = sharePhotos && qty > 1 ? `manual/${ids[0]}` : ids[0];
        fotoUrls = await uploadPhotos(compressed, uploadPrefix);
      } catch {} finally {
        setBusy(false);
      }
    }

    for (const it of newItems) {
      await fsSet("manuais", it.id, { ...it, unidadeId: unidadeAtiva?.id });
    }

    const novaAtiva = { ...unidadeAtiva, itens: [...unidadeAtiva.itens, ...newItems] };
    inventario.setUnidadesAtivas((prev) => prev.map((u) => (u.id === novaAtiva.id ? novaAtiva : u)));
    setUnidades((prev) => prev.map((u) => (u.id === novaAtiva.id ? novaAtiva : u)));
    appendItemsToFinalizadoScope(novaAtiva.id, newItems);

    for (const it of newItems) {
      const createdResult = await found.markFound({
        itemId: it.id,
        estado: getField("manEstado") || "Bom",
        situacao: getField("manSituacao") || "Em uso",
        localId: getField("manLocal") || sessionLocais[0]?.id || "",
        obs: desc.trim(),
        marca: getField("manMarca"),
        origem: getField("manOrigem") || "Próprio",
        extras: doacaoExtras,
        fotoUrls,
        unidadeAtiva,
        logado: auth.logado,
        isManual: true,
      });
      await logAuditoria("create", "manuais", it.id, null, { ...it, unidadeId: unidadeAtiva?.id, fotoUrls, inventario: createdResult?.entry });
    }

    clearUiResume();
    setModal(null);
    showT(qty > 1 ? `Itens adicionados: ${qty}` : "Salvo!");
    notificationService.notify(EVENTOS.ITEM_ENCONTRADO, { message: "Item manual salvo", type: "success" });
  };

  const addSemTomboItem = async () => {
    if (!assertPodeEditar()) return;
    const desc = String(getField("stDesc") || "").trim();
    if (!desc) {
      showT("Informe o nome do item");
      return;
    }
    const localId = String(getField("stLocal") || "").trim();
    if (!localId) {
      showT("Selecione um local da sessão");
      return;
    }
    const unitId = String(getField("stUnidadeId") || unidadeAtiva?.id || "").trim();
    const unit = editScopeUnits.find((u) => u.id === unitId) || unidadeAtiva;
    if (!unit) {
      showT("Unidade não encontrada");
      return;
    }
    if (!formRef.current.stPhotos?.length) {
      showT("Tire pelo menos uma foto do item");
      return;
    }

    const id = `ST_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const item = {
      id,
      patrimonioLabel: "S/T",
      data: new Date().toLocaleDateString("pt-BR"),
      especie: inferEspecieFromDesc(desc, sugestoes?.especies),
      descricao: desc,
      marca: "",
      fornecedor: "",
      empenho: "",
      nf: "",
      dataNF: "",
      valor: 0,
      valorAtual: 0,
      isManual: true,
      semTombo: true,
      identificadoPorFoto: true,
    };

    const stOrigem = getField("stOrigem") || "Próprio";
    const stImei = String(getField("stImei") || "").trim();
    const stCor = String(getField("stCor") || "").trim();
    const stExtras = {
      semTombo: true,
      identificadoPorFoto: true,
      descricaoEdit: desc,
      tomboReferencia: String(getField("stTomboRef") || "").trim(),
      marca: String(getField("stMarca") || "").trim(),
      ...(stImei ? { imei: stImei } : {}),
      ...(stCor ? { cor: stCor } : {}),
      ...buildDoacaoOrigemExtras(getField, "st"),
    };
    const stEstado = getField("stEstado") || "Bom";
    const stObs = String(getField("stObs") || "").trim();

    if (!navigator.onLine) {
      const now = new Date();
      const invEntry = {
        patrimonioId: id,
        unidadeId: unit.id,
        unidadeNome: unit.nome,
        estado: stEstado,
        situacao: "Em uso",
        localId,
        obs: stObs,
        marca: "",
        origem: stOrigem,
        fotoUrls: [],
        data: now.toLocaleDateString("pt-BR"),
        hora: now.toLocaleTimeString("pt-BR"),
        usuario: auth.logado?.nome || "",
        email: auth.logado?.email || "",
        ultimaAtualizacao: now.toISOString(),
        user: auth.logado?.nome || "",
        ...stExtras,
      };
      await queueOfflineWithPhotos({
        type: "batch",
        data: {
          steps: [
            { collection: "manuais", docId: id, content: { ...item, unidadeId: unit.id } },
            { collection: "inventario", docId: id, content: invEntry, usePhotos: true },
          ],
          uploadPrefix: id,
        },
        photos: formRef.current.stPhotos || [],
      });
      updateQueueStatus();
      const novaAtiva = { ...unit, itens: [...unit.itens, item] };
      inventario.setUnidadesAtivas((prev) => prev.map((u) => (u.id === novaAtiva.id ? novaAtiva : u)));
      setUnidades((prev) => prev.map((u) => (u.id === novaAtiva.id ? novaAtiva : u)));
      appendItemsToFinalizadoScope(novaAtiva.id, [item]);
      await found.markFound({
        itemId: id,
        estado: stEstado,
        situacao: "Em uso",
        localId,
        obs: stObs,
        marca: stExtras.marca || "",
        origem: stOrigem,
        fotoUrls: [],
        extras: stExtras,
        unidadeAtiva: unit,
        itemUnit: unit,
        logado: auth.logado,
        localOnly: true,
      });
      revokeBlobUrls(formRef.current.stPhotos || []);
      setModal(null);
      showT("Na fila (offline)");
      return;
    }

    let fotoUrls = [];
    if (isStorageOk()) {
      setBusy(true);
      try {
        const compressed = await compressPhotoArray(formRef.current.stPhotos);
        fotoUrls = await uploadPhotos(compressed, id);
      } catch {
        showT("Erro ao enviar fotos");
        setBusy(false);
        return;
      } finally {
        setBusy(false);
      }
    }

    await fsSet("manuais", id, { ...item, unidadeId: unit.id });
    const novaAtiva = { ...unit, itens: [...unit.itens, item] };
    inventario.setUnidadesAtivas((prev) => prev.map((u) => (u.id === novaAtiva.id ? novaAtiva : u)));
    setUnidades((prev) => prev.map((u) => (u.id === novaAtiva.id ? novaAtiva : u)));
    appendItemsToFinalizadoScope(novaAtiva.id, [item]);

    await found.markFound({
      itemId: id,
      estado: stEstado,
      situacao: "Em uso",
      localId,
      obs: stObs,
      marca: stExtras.marca || "",
      origem: stOrigem,
      fotoUrls,
      extras: stExtras,
      unidadeAtiva: unit,
      itemUnit: unit,
      logado: auth.logado,
    });

    revokeBlobUrls(formRef.current.stPhotos || []);
    setModal(null);
    showT("Salvo!");
  };

  const addMultiItems = async ({ shared, rows }) => {
    if (!assertPodeEditar()) return;
    const unidadeAtivaMulti = inventario.unidadesAtivas[0];
    if (!unidadeAtivaMulti) {
      showT("Selecione uma unidade");
      return;
    }
    const desc = String(shared.descricao || "").trim();
    if (!desc) {
      showT("Descrição compartilhada obrigatória");
      return;
    }

    const baseNow = Date.now();
    const existingIds = new Set((unidadeAtivaMulti?.itens || []).map((i) => i.id));
    let saved = 0;

    const multiOrigem = shared.origem || "Próprio";
    const multiDoacaoExtras = (() => {
      if (multiOrigem !== "Doação") return {};
      if ((shared.multiDoacaoModo || "uf") === "texto") {
        const texto = String(shared.multiDoacaoTexto || "").trim();
        return texto ? { doacaoOrigem: texto, doacaoOrigemTipo: "texto" } : {};
      }
      const uf = String(shared.multiDoacaoUf || "MA").trim().toUpperCase();
      return uf ? { doacaoOrigem: uf, doacaoOrigemTipo: "uf" } : {};
    })();

    const prepared = [];
    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const rowPhotos = Array.isArray(row.photos)
        ? row.photos
        : multiRowsPhotosRef.current[String(idx)] || [];
      const tombamento = String(row.tombamento || "").trim();
      if (!tombamento && rowPhotos.length === 0) continue;

      let itemId;
      let patrimonioLabel;
      if (tombamento) {
        itemId = `MAN_${baseNow}_${Math.random().toString(36).slice(2, 6)}_${idx}`;
        patrimonioLabel = tombamento;
      } else {
        itemId = `ST_${baseNow}_${Math.random().toString(36).slice(2, 6)}_${idx}`;
        patrimonioLabel = "S/T";
      }
      while (existingIds.has(itemId)) {
        itemId = `${itemId}_${Math.random().toString(36).slice(2, 4)}`;
      }
      existingIds.add(itemId);

      const item = {
        id: itemId,
        patrimonioLabel,
        ...(tombamento ? { tomboRef: tombamento } : {}),
        data: new Date().toLocaleDateString("pt-BR"),
        especie: String(shared.especie || inferEspecieFromDesc(desc, sugestoes?.especies) || "").toUpperCase(),
        descricao: desc,
        marca: shared.marca || "",
        fornecedor: shared.fornecedor || "",
        empenho: "",
        nf: "",
        dataNF: "",
        valor: parseFloat(shared.valor) || 0,
        valorAtual: 0,
        isManual: true,
        tipoEntrada: multiOrigem,
        ...(patrimonioLabel === "S/T" ? { semTombo: true, identificadoPorFoto: rowPhotos.length > 0 } : {}),
      };

      const extras = {
        ...(patrimonioLabel === "S/T"
          ? { semTombo: true, identificadoPorFoto: rowPhotos.length > 0, descricaoEdit: desc }
          : { descricaoEdit: desc }),
        ...multiDoacaoExtras,
        ...(String(row.cor || "").trim() ? { cor: String(row.cor).trim() } : {}),
      };

      const now = new Date();
      const invContent = {
        patrimonioId: itemId,
        unidadeId: unidadeAtivaMulti.id || "",
        unidadeNome: unidadeAtivaMulti.nome || "",
        estado: row.estado || "Bom",
        situacao: "Em uso",
        localId: shared.localId,
        obs: String(row.obs || "").trim(),
        marca: shared.marca || "",
        origem: multiOrigem,
        fotoUrls: [],
        data: now.toLocaleDateString("pt-BR"),
        hora: now.toLocaleTimeString("pt-BR"),
        usuario: auth.logado?.nome || "",
        email: auth.logado?.email || "",
        ultimaAtualizacao: now.toISOString(),
        user: auth.logado?.nome || "",
        isManual: true,
        ...extras,
      };

      prepared.push({ item, rowPhotos, extras, invContent, estado: row.estado || "Bom", obs: String(row.obs || "").trim() });
    }

    if (!prepared.length) {
      showT("Nenhuma linha válida (informe tombo ou foto)");
      return;
    }

    if (!navigator.onLine) {
      for (const p of prepared) {
        await queueOfflineWithPhotos({
          type: "batch",
          data: {
            steps: [
              { collection: "manuais", docId: p.item.id, content: { ...p.item, unidadeId: unidadeAtivaMulti.id } },
              {
                collection: "inventario",
                docId: p.item.id,
                content: p.invContent,
                usePhotos: Boolean(p.rowPhotos?.length),
              },
            ],
            uploadPrefix: p.item.id,
          },
          photos: p.rowPhotos || [],
        });
      }
      updateQueueStatus();
      const newItems = prepared.map((p) => p.item);
      const novaAtiva = { ...unidadeAtivaMulti, itens: [...unidadeAtivaMulti.itens, ...newItems] };
      inventario.setUnidadesAtivas((prev) => prev.map((u) => (u.id === novaAtiva.id ? novaAtiva : u)));
      setUnidades((prev) => prev.map((u) => (u.id === novaAtiva.id ? novaAtiva : u)));
      appendItemsToFinalizadoScope(novaAtiva.id, newItems);
      for (const p of prepared) {
        await found.markFound({
          itemId: p.item.id,
          estado: p.estado,
          situacao: "Em uso",
          localId: shared.localId,
          obs: p.obs,
          marca: shared.marca || "",
          origem: multiOrigem,
          fotoUrls: [],
          extras: p.extras,
          unidadeAtiva: unidadeAtivaMulti,
          logado: auth.logado,
          localOnly: true,
          isManual: true,
        });
      }
      multiRowsPhotosRef.current = {};
      clearUiResume();
      setModal(null);
      showT(`${prepared.length} item(s) na fila (offline)`);
      notificationService.notify(EVENTOS.ITEM_ENCONTRADO, { message: "Itens enfileirados offline", type: "info" });
      return;
    }

    for (const p of prepared) {
      let fotoUrls = [];
      if (p.rowPhotos.length > 0 && isStorageOk()) {
        try {
          const compressed = await compressPhotoArray(p.rowPhotos);
          fotoUrls = await uploadPhotos(compressed, p.item.id);
        } catch (e) {
          console.warn("Falha upload fotos multi", p.item.id, e);
        }
      }

      try {
        await fsSet("manuais", p.item.id, { ...p.item, unidadeId: unidadeAtivaMulti.id });
        await found.markFound({
          itemId: p.item.id,
          estado: p.estado,
          situacao: "Em uso",
          localId: shared.localId,
          obs: p.obs,
          marca: shared.marca || "",
          origem: multiOrigem,
          fotoUrls,
          extras: p.extras,
          unidadeAtiva: unidadeAtivaMulti,
          logado: auth.logado,
          isManual: true,
        });
        saved++;
      } catch (e) {
        console.error("Erro salvando linha multi", p.item.id, e);
      }
    }

    const newItems = prepared.map((p) => p.item);
    const novaAtiva = { ...unidadeAtivaMulti, itens: [...unidadeAtivaMulti.itens, ...newItems] };
    inventario.setUnidadesAtivas((prev) => prev.map((u) => (u.id === novaAtiva.id ? novaAtiva : u)));
    setUnidades((prev) => prev.map((u) => (u.id === novaAtiva.id ? novaAtiva : u)));
    appendItemsToFinalizadoScope(novaAtiva.id, newItems);

    multiRowsPhotosRef.current = {};
    clearUiResume();
    setModal(null);
    showT(`${saved} item(s) cadastrado(s)`);
  };

  const addSemTomboPendentes = async () => {
    if (!assertPodeEditar()) return;
    const selected = Array.isArray(formRef.current.stSelectedIds) ? formRef.current.stSelectedIds : [];
    if (!selected.length) {
      showT("Selecione ao menos um item pendente");
      return;
    }
    const localId = String(getField("stLocal") || "").trim();
    if (!localId) {
      showT("Selecione um local da sessão");
      return;
    }
    if (!formRef.current.stPhotos?.length) {
      showT("Tire pelo menos uma foto");
      return;
    }

    const estado = getField("stEstado") || "Bom";
    const stObsBatch = String(getField("stObs") || "").trim();
    const batchExtras = { alocadoManualmente: true, fotoCompartilhada: true };

    if (!navigator.onLine) {
      const steps = [];
      let count = 0;
      for (const itemId of selected) {
        const item = inventario.allItens.find((i) => i.id === itemId);
        if (!item || isItemInventariado(itemId, found.foundSet)) continue;
        const unit = editScopeUnits.find((u) => u.id === item.unidadeId) || unidadeAtiva;
        const now = new Date();
        steps.push({
          collection: "inventario",
          docId: itemId,
          // Foto do lote é compartilhada por TODOS os itens (igual ao fluxo
          // online) — antes só o 1º passo recebia a foto ao sincronizar.
          usePhotos: true,
          content: {
            patrimonioId: itemId,
            unidadeId: unit?.id || "",
            unidadeNome: unit?.nome || "",
            estado: defaultEstadoForItem(item) === "Novo" ? "Novo" : estado,
            situacao: item.tipoEntrada === "Permuta" ? "Permuta" : "Em uso",
            localId,
            obs: stObsBatch,
            marca: item.marca || "",
            origem: item.tipoEntrada === "Permuta" ? "Permuta" : item.tipoEntrada || "Próprio",
            fotoUrls: [],
            data: now.toLocaleDateString("pt-BR"),
            hora: now.toLocaleTimeString("pt-BR"),
            usuario: auth.logado?.nome || "",
            email: auth.logado?.email || "",
            ultimaAtualizacao: now.toISOString(),
            user: auth.logado?.nome || "",
            ...batchExtras,
          },
        });
        await found.markFound({
          itemId,
          estado: defaultEstadoForItem(item) === "Novo" ? "Novo" : estado,
          situacao: item.tipoEntrada === "Permuta" ? "Permuta" : "Em uso",
          localId,
          obs: stObsBatch,
          marca: item.marca || "",
          origem: item.tipoEntrada === "Permuta" ? "Permuta" : item.tipoEntrada || "Próprio",
          fotoUrls: [],
          extras: batchExtras,
          unidadeAtiva: unit,
          itemUnit: unit,
          logado: auth.logado,
          localOnly: true,
        });
        count++;
      }
      if (count > 0) {
        await queueOfflineWithPhotos({
          type: "batch",
          data: { steps, uploadPrefix: `batch/${Date.now()}_${selected[0]}` },
          photos: formRef.current.stPhotos || [],
        });
        updateQueueStatus();
      }
      revokeBlobUrls(formRef.current.stPhotos || []);
      setModal(null);
      showT(count > 1 ? `${count} itens na fila (offline)` : count ? "Na fila (offline)" : "Nenhum item válido");
      return;
    }

    let fotoUrls = [];
    if (isStorageOk()) {
      setBusy(true);
      try {
        const compressed = await compressPhotoArray(formRef.current.stPhotos);
        const prefix = `batch/${Date.now()}_${selected[0]}`;
        fotoUrls = await uploadPhotos(compressed, prefix);
      } catch {
        showT("Erro ao enviar fotos");
        setBusy(false);
        return;
      } finally {
        setBusy(false);
      }
    }

    const estadoBatch = getField("stEstado") || "Bom";
    let count = 0;
    for (const itemId of selected) {
      const item = inventario.allItens.find((i) => i.id === itemId);
      if (!item || isItemInventariado(itemId, found.foundSet)) continue;
      const unit = inventario.unidadesAtivas.find((u) => u.id === item.unidadeId) || unidadeAtiva;
      await found.markFound({
        itemId,
        estado: defaultEstadoForItem(item) === "Novo" ? "Novo" : estadoBatch,
        situacao: item.tipoEntrada === "Permuta" ? "Permuta" : "Em uso",
        localId,
        obs: stObsBatch,
        marca: item.marca || "",
        origem: item.tipoEntrada === "Permuta" ? "Permuta" : item.tipoEntrada || "Próprio",
        fotoUrls,
        extras: batchExtras,
        unidadeAtiva: unit,
        itemUnit: unit,
        logado: auth.logado,
        updateQueueStatus,
      });
      count++;
    }

    revokeBlobUrls(formRef.current.stPhotos || []);
    setModal(null);
    showT(count > 1 ? `${count} itens registrados com a mesma foto` : "Salvo!");
  };

  const openLinkTomboModal = (stItem, stFound, preselectId = "") => {
    let realId = preselectId || "";
    if (!realId && stItem) {
      const stUnitId = stItem.unidadeId || stFound?.unidadeId;
      const pool = scopeAllItens.filter((i) => {
        if (i.id === stItem.id) return false;
        if (isSemTomboItem(i, found.foundMap[i.id])) return false;
        if (String(i.id || "").startsWith("ST_") || String(i.id || "").startsWith("MAN_")) return false;
        if (found.foundSet.has(i.id)) return false;
        if (stUnitId && i.unidadeId && i.unidadeId !== stUnitId) return false;
        return true;
      });
      const top = rankTombosForAjuste(stItem, stFound, pool, { minScore: 0, limit: 1 })[0];
      if (top?.score >= 40) realId = top.item.id;
    }
    formRef.current = {
      ...formRef.current,
      ajusteStId: stItem?.id || "",
      ajusteStItem: stItem,
      ajusteStFound: stFound,
      ajusteSearch: "",
      ajusteRealId: realId,
    };
    bumpFt();
    setModal("ajusteLink");
  };

  const linkSemTomboToTombo = async () => {
    const stId = String(formRef.current.ajusteStId || "").trim();
    const realId = String(formRef.current.ajusteRealId || "").trim();
    if (!stId || !realId) {
      showT("Selecione o tombo de destino");
      return;
    }
    if (stId === realId) {
      showT("Selecione um tombo diferente");
      return;
    }
    if (isItemInventariado(realId, found.foundSet)) {
      showT("Este tombo já foi inventariado");
      return;
    }

    if (navigator.onLine) {
      try {
        const serverDest = await fsGetDoc("inventario", realId);
        if (serverDest?.ultimaAtualizacao || serverDest?.patrimonioId) {
          showT("Este tombo já foi inventariado por outro usuário");
          return;
        }
      } catch {}
    }

    const stFound = getFoundEntry(stId, found.foundMap);
    if (!stFound) {
      showT("Registro sem tombo não encontrado");
      return;
    }

    let realItem = null;
    let realUnit = null;
    for (const u of unidades) {
      const hit = u.itens.find((i) => i.id === realId);
      if (hit) {
        realItem = hit;
        realUnit = u;
        break;
      }
    }
    if (!realItem) {
      showT("Tombo de destino não encontrado no patrimônio");
      return;
    }
    if (isSemTomboItem(realItem, getFoundEntry(realId, found.foundMap))) {
      showT("Destino também é item sem tombo");
      return;
    }

    setBusy(true);
    try {
      const stItem = scopeAllItens.find((i) => i.id === stId) || formRef.current.ajusteStItem;
      // Origem manual (ST_/MAN_) some da lista; tombo da planilha volta a pendente.
      const sourceIsManual = !!(stItem?.isManual || /^(ST_|MAN_)/i.test(stId));
      const entry = {
        ...stFound,
        patrimonioId: realId,
        unidadeId: realUnit.id,
        unidadeNome: realUnit.nome,
        alocadoManualmente: true,
        ...(sourceIsManual
          ? {
              vinculadoDeSemTombo: true,
              semTomboOrigemId: stId,
              semTomboOrigemDesc: stFound.descricaoEdit || stItem?.descricao || "",
              tomboLabelFisico: String(stFound.tomboReferencia || stItem?.patrimonioLabel || stId).trim() || "",
            }
          : {
              reatribuidoDeTombo: stId,
              reatribuidoDeLabel: String(stItem?.patrimonioLabel || stId),
            }),
        semTombo: false,
        identificadoPorFoto: false,
        ultimaAtualizacao: new Date().toISOString(),
      };
      delete entry._id;

      await fsSet("inventario", realId, entry);
      await fsDel("inventario", stId);
      if (sourceIsManual) {
        try {
          await fsDel("manuais", stId);
        } catch {}
      }

      const nextFound = found.found.filter((f) => f.patrimonioId !== stId);
      nextFound.push({ ...entry, _id: realId, patrimonioId: realId });
      found.syncFoundRef(nextFound);
      bumpCacheBuster();
      await setCachedData("inventario", nextFound);

      if (sourceIsManual) {
        setUnidades((prev) =>
          prev.map((u) => ({
            ...u,
            itens: u.itens.filter((i) => i.id !== stId),
          })),
        );
        inventario.setUnidadesAtivas((prev) =>
          prev.map((u) => ({
            ...u,
            itens: u.itens.filter((i) => i.id !== stId),
          })),
        );
      }

      if (finalizadoEdit?.fin?.id && !finalizadoEdit.fin.legacy) {
        const stats = buildFinalizacaoStats(finalizadoEdit.units, found.foundSet);
        atualizarStatsFinalizacao(finalizadoEdit.fin.id, stats);
      }

      await logAuditoria("link-tombo", "inventario", realId, stFound, entry);
      setModal(null);
      showT(
        sourceIsManual
          ? `Vinculado ao tombo ${realItem.patrimonioLabel || realId}`
          : `Registro movido para o tombo ${realItem.patrimonioLabel || realId} — o tombo ${stItem?.patrimonioLabel || stId} voltou a pendente`,
      );
    } catch (e) {
      showT(e?.message || "Erro ao vincular tombo");
    } finally {
      setBusy(false);
    }
  };

  // Correção pós-registro: o item foi inventariado num tombo da planilha, mas
  // descobriu-se depois que o tombo estava errado e o item físico não tem tombo.
  // O registro (fotos, local, estado, obs) vira um item manual S/T e o tombo
  // original volta a ficar pendente na planilha.
  const corrigirParaSemTombo = async () => {
    if (!assertPodeEditar()) return;
    const item = formRef.current.detItem;
    if (!item?.id) return;
    const f = getFoundEntry(item.id, found.foundMap);
    if (!f) {
      showT("Item ainda não foi inventariado");
      return;
    }
    if (item.isManual || isSemTomboItem(item, f) || /^(ST_|MAN_)/i.test(String(item.id))) {
      showT("Disponível apenas para tombos da planilha");
      return;
    }
    const label = item.patrimonioLabel || item.id;
    const ok = window.confirm(
      `Corrigir registro?\n\nEste registro (fotos, local, estado) vira um item manual SEM TOMBO e o tombo ${label} volta a ficar pendente na planilha.`
    );
    if (!ok) return;

    setBusy(true);
    try {
      const unit = editScopeUnits.find((u) => u.id === (f.unidadeId || item.unidadeId)) || unidadeAtiva;
      const newId = `ST_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const desc = f.descricaoEdit || item.descricao || item.especie || "";
      const temFoto = (f.fotoUrls || []).length > 0;
      const manualItem = {
        id: newId,
        patrimonioLabel: "S/T",
        data: new Date().toLocaleDateString("pt-BR"),
        especie: f.especieEdit || item.especie || "",
        descricao: desc,
        marca: f.marca || item.marca || "",
        fornecedor: "",
        empenho: "",
        nf: "",
        dataNF: "",
        valor: 0,
        valorAtual: 0,
        isManual: true,
        tipoEntrada: f.origem || "Próprio",
        semTombo: true,
        identificadoPorFoto: temFoto,
      };
      const entry = {
        ...f,
        patrimonioId: newId,
        unidadeId: unit?.id || f.unidadeId || "",
        unidadeNome: unit?.nome || f.unidadeNome || "",
        isManual: true,
        semTombo: true,
        identificadoPorFoto: temFoto,
        descricaoEdit: desc,
        corrigidoDeTombo: item.id,
        corrigidoDeLabel: label,
        ultimaAtualizacao: new Date().toISOString(),
      };
      delete entry._id;

      await fsSet("manuais", newId, { ...manualItem, unidadeId: unit?.id || "" });
      await fsSet("inventario", newId, entry);
      await fsDel("inventario", normalizePatrimonioId(item.id));

      const oldNorm = normalizePatrimonioId(item.id);
      const nextFound = (found.foundRef.current || []).filter(
        (x) => normalizePatrimonioId(x.patrimonioId || x._id) !== oldNorm
      );
      nextFound.push({ ...entry, _id: newId });
      found.syncFoundRef(nextFound);
      bumpCacheBuster();
      await setCachedData("inventario", nextFound);

      if (unit?.id) {
        const addTo = (u) => (u.id === unit.id ? { ...u, itens: [...u.itens, manualItem] } : u);
        setUnidades((prev) => prev.map(addTo));
        inventario.setUnidadesAtivas((prev) => prev.map(addTo));
        appendItemsToFinalizadoScope(unit.id, [manualItem]);
      }

      await logAuditoria("corrige-tombo-semtombo", "inventario", newId, f, entry);
      clearUiResume();
      setModal(null);
      showT(`Registro virou item sem tombo — tombo ${label} voltou a pendente`);
    } catch (e) {
      showT(e?.message || "Erro ao corrigir registro");
    } finally {
      setBusy(false);
    }
  };

  const confirmarTomboDivergente = async (foundId, foundEntry) => {
    if (!assertPodeEditar()) return;
    const docId = String(foundEntry?.patrimonioId || foundId || "").trim();
    if (!docId) return;
    const cur = getFoundEntry(docId, found.foundMap) || foundEntry;
    if (!cur) {
      showT("Registro não encontrado");
      return;
    }
    setBusy(true);
    try {
      const entry = {
        ...cur,
        tomboEstrangeiroOk: true,
        ultimaAtualizacao: new Date().toISOString(),
      };
      delete entry._id;
      await fsSet("inventario", docId, entry);
      const next = found.found.map((f) =>
        String(f.patrimonioId || f._id) === docId ? { ...entry, _id: docId, patrimonioId: docId } : f
      );
      found.setFound(next);
      bumpCacheBuster();
      await setCachedData("inventario", next);
      showT("Tombo divergente aceito — registro mantido");
    } catch (e) {
      showT(e?.message || "Erro ao confirmar");
    } finally {
      setBusy(false);
    }
  };

  const getSemTomboPendentes = () => {
    const q = String(formRef.current.stPendSearch || "").trim().toLowerCase();
    return scopeAllItens.filter((i) => {
      if (hideIncorporados && (i.tipoEntrada || "") === "Incorporado") return false;
      if (isItemInventariado(i.id, found.foundSet)) return false;
      if (isSemTomboItem(i, getFoundEntry(i.id, found.foundMap))) return false;
      if (!q) return true;
      return (
        String(i.id || "").toLowerCase().includes(q) ||
        String(i.descricao || "").toLowerCase().includes(q) ||
        String(i.especie || "").toLowerCase().includes(q) ||
        String(i.fornecedor || "").toLowerCase().includes(q) ||
        String(i.marca || "").toLowerCase().includes(q) ||
        String(i.nf || "").toLowerCase().includes(q)
      );
    });
  };

  const toggleStPending = (id) => {
    const cur = new Set(formRef.current.stSelectedIds || []);
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    formRef.current.stSelectedIds = [...cur];
    bumpFt();
  };

  const gerarRelatorio = async (formato = "pdf") => {
    if (!unidadeAtiva?.id) {
      showT("Selecione uma unidade");
      return;
    }

    try {
      setBusy(true);
      if (formato === "pdf") {
        const doc = await gerarRelatorioPDF(unidadeAtiva.id, unidades, found.found);
        doc.save(`relatorio_${unidadeAtiva.id}_${Date.now()}.pdf`);
      } else {
        const { workbook, XLSX } = await gerarRelatorioExcel(unidadeAtiva.id, unidades, found.found);
        XLSX.writeFile(workbook, `relatorio_${unidadeAtiva.id}_${Date.now()}.xlsx`);
      }
      await logAuditoria("export", "relatorio", unidadeAtiva.id, null, { formato });
      showT(`Relatório em ${formato.toUpperCase()} gerado`);
    } catch {
      showT("Erro ao gerar relatório");
    } finally {
      setBusy(false);
    }
  };

  const fazerBackup = async () => {
    try {
      setBusy(true);
      const backup = await criarBackupManual();
      notificationService.notify(EVENTOS.BACKUP_CRIADO, {
        message: `Backup ${backup.id} criado`,
        type: "success",
      });
      showT(`Backup criado (${(backup.tamanho / 1024).toFixed(0)}KB)`);
    } catch {
      showT("Erro ao criar backup");
    } finally {
      setBusy(false);
    }
  };

  const finalizarInv = async () => {
    const pendentes = inventario.allItens.filter((i) => !isItemInventariado(i.id, found.foundSet));
    for (const item of pendentes) {
      const ne = { patrimonioId: item.id, descricao: item.descricao, especie: item.especie, unidade: item.unidadeNome, dataFin: new Date().toLocaleDateString("pt-BR") };
      await fsSet("tombosNE", item.id, ne);
    }
    found.setTombosNE((prev) => [...prev, ...pendentes.map((i) => ({ ...i, unidade: i.unidadeNome, dataFin: new Date().toLocaleDateString("pt-BR") }))]);
    // Clear active inventory and paused sessions when finalizing!
    inventario.limparSessoesDeUnidades(inventario.unidadesAtivas.map((u) => u.id));
    inventario.clearAtivas();
    setModal(null);
    showT(`Finalizado! ${pendentes.length} não encontrado(s)`);
  };

  const finalizarComCoordenadora = async () => {
    if (finalizandoRef.current || busy) {
      showT("Finalização em andamento — aguarde");
      return;
    }
    const nome = String(getField("coordNome") || "").trim();
    const matricula = String(getField("coordMatricula") || "").trim();
    if (!nome || !matricula) {
      showT("Preencha nome e matrícula da coordenadora");
      return;
    }
    if (inventario.unidadesAtivas.length === 0) {
      showT("Nenhuma unidade em inventário");
      return;
    }

    finalizandoRef.current = true;
    setBusy(true);

    try {
      const token = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const agora = new Date();
      const dataExpiracao = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);
      const unidadeIds = inventario.unidadesAtivas.map((u) => u.id);
      const unidadeNomes = inventario.unidadesAtivas.map((u) => u.nome);

      const convite = {
        token,
        unidadeId: unidadeAtiva?.id || unidadeIds[0],
        unidadeNome: unidadeAtiva?.nome || unidadeNomes[0],
        unidadeIds,
        unidadeNomes,
        matricula,
        nomeSugerido: nome,
        status: "ativo",
        dataCriacao: agora.toISOString(),
        dataExpiracao: dataExpiracao.toISOString(),
        dataUso: null,
      };
      await fsSet("convites", token, convite);

      const base = import.meta.env.BASE_URL || "/";
      const prefix = base.endsWith("/") ? base : `${base}/`;
      const link = `${window.location.origin}${prefix}#/coordregistro/${token}`;
      setCoordRegistroLink(link);
      const qrUrl = await generateQRCode(link);
      setQrCodeUrl(qrUrl);

      const pendentes = inventario.allItens.filter((i) => !isItemInventariado(i.id, found.foundSet));
      const dataFin = new Date().toLocaleDateString("pt-BR");
      for (const item of pendentes) {
        const ne = { patrimonioId: item.id, descricao: item.descricao, especie: item.especie, unidade: item.unidadeNome, dataFin, coordenadora: nome, matricula };
        await fsSet("tombosNE", item.id, ne);
      }
      found.setTombosNE((prev) => [...prev, ...pendentes.map((i) => ({ ...i, unidade: i.unidadeNome, dataFin, coordenadora: nome, matricula }))]);

      const stats = buildFinalizacaoStats(inventario.unidadesAtivas, found.foundSet);
      try {
        await criarFinalizacao({
          unidadeIds,
          unidadeNomes,
          sessionId: inventario.sessionId || "",
          coordenadora: { nome, matricula },
          conviteToken: token,
          stats,
          finalizedBy: {
            uid: auth.logado?.uid || "",
            nome: auth.logado?.nome || "",
            email: auth.logado?.email || "",
          },
        });
        finalizacoesState.refresh?.();
      } catch {
        showT("Finalizado, mas falha ao registrar na lista de Finalizados");
      }

      // Clear active inventory and paused sessions when finalizing!
      inventario.limparSessoesDeUnidades(unidadeIds);
      inventario.clearAtivas();
      setModal("qrcode-resultado");
      showT("Convite criado! A coordenadora se cadastra pelo QR Code e você aprova em Coordenadores.");
    } catch (err) {
      console.error("Erro ao finalizar:", err);
      showT("Erro ao finalizar — tente novamente");
    } finally {
      setBusy(false);
      finalizandoRef.current = false;
    }
  };

  return { aplicarCorrecaoNomes, lookupTombo, quickMarkFound, addManual, addSemTomboItem, addMultiItems,
    addSemTomboPendentes, openLinkTomboModal, linkSemTomboToTombo, corrigirParaSemTombo,
    confirmarTomboDivergente, getSemTomboPendentes, toggleStPending,
    gerarRelatorio, fazerBackup, finalizarInv, finalizarComCoordenadora };
}
