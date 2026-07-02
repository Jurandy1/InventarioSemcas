import { useCallback, useMemo, useRef, useState } from "react";
import { fsDel, fsGetAll, fsGetDoc, fsSet } from "../services/firebase.js";
import { deletePhoto, isStorageOk, uploadPhotos } from "../services/storage.js";
import { EVENTOS, notificationService, offlineManager, queueOfflineWithPhotos } from "../services/features.js";
import { logAuditoria } from "../services/audit.js";
import { bumpCacheBuster, compressPhotoArray, getCachedData, perfMonitor, setCachedData } from "../utils/performance.js";
import { mergeFoundRecords } from "../utils/inventorySession.js";
import { getFoundEntry, normalizePatrimonioId } from "../utils/patrimonioId.js";
import { fetchInventarioForUnits, normalizeFoundRecord } from "../services/inventarioLoad.js";
import { saveOfflinePhotos } from "../utils/offlineStore.js";

export function useFound({ showT, applyDescOverride } = {}) {
  const [found, setFound] = useState([]);
  const [tombosNE, setTombosNE] = useState([]);
  const [tombosDup, setTombosDup] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");

  const foundRef = useRef([]);
  const foundPosRef = useRef(new Map());

  const syncFoundRef = useCallback(
    (next) => {
      const normalized = (next || []).map(normalizeFoundRecord);
      foundRef.current = normalized;
      foundPosRef.current = new Map(normalized.map((f, idx) => [f.patrimonioId, idx]));
      setFound(normalized);
    },
    [setFound]
  );

  const foundSet = useMemo(() => new Set(found.map((f) => normalizePatrimonioId(f.patrimonioId || f._id)).filter(Boolean)), [found]);
  const foundMap = useMemo(() => {
    const m = {};
    for (const f of found) {
      const rawId = f.patrimonioId || f._id;
      const normalizedId = normalizePatrimonioId(rawId);
      if (normalizedId) m[normalizedId] = f;
      // Também indexar pelo ID bruto para casos onde item.id não está normalizado
      // (ex: itens manuais com tombamento digitado como "123/2024" → id "123-2024")
      const rawStr = String(rawId || "");
      if (rawStr && rawStr !== normalizedId) m[rawStr] = f;
    }
    return m;
  }, [found]);

  const loadFoundAndTombos = useCallback(async (unitIds = [], options = {}) => {
    const keepItemIds = options.keepItemIds || [];
    const itemUnits = options.itemUnits || null;

    try {
      const [cachedFound, cachedTombos] = await Promise.all([getCachedData("inventario"), getCachedData("tombosNE")]);
      const memoryPrev = foundRef.current || [];
      const basePrev =
        memoryPrev.length > 0
          ? memoryPrev
          : Array.isArray(cachedFound) && cachedFound.length > 0
            ? cachedFound
            : [];
      if (memoryPrev.length === 0 && basePrev.length > 0) syncFoundRef(basePrev);

      const ids = Array.isArray(unitIds) ? unitIds.filter(Boolean) : [];
      let foundDocs = [];
      let neDocs = [];
      if (!options.cacheOnly) {
        foundDocs = await fetchInventarioForUnits(ids, {
          patrimonioIds: options.patrimonioIds || [],
        });
        neDocs = await fsGetAll("tombosNE", { pageSize: 200 });
      } else {
        neDocs = Array.isArray(cachedTombos) ? cachedTombos : [];
      }

      const incoming = foundDocs.map((d) => normalizeFoundRecord({ ...d, patrimonioId: d.patrimonioId || d._id }));
      const nextFound = mergeFoundRecords(basePrev, incoming, { keepItemIds, itemUnits });
      const nextTombos = neDocs.map((d) => ({ ...d, id: d._id || d.id }));

      syncFoundRef(nextFound);
      setTombosNE(nextTombos);

      await Promise.all([setCachedData("inventario", nextFound), setCachedData("tombosNE", nextTombos)]);
      return { found: nextFound, tombosNE: nextTombos };
    } catch (e) {
      console.warn("Erro ao carregar inventário:", e);
      return { found: foundRef.current || [], tombosNE: [] };
    }
  }, [syncFoundRef]);

  const markFound = useCallback(
    async ({
      itemId,
      estado,
      situacao,
      localId,
      obs,
      marca,
      origem,
      fotoUrls = [],
      extras = {},
      unidadeAtiva,
      itemUnit,
      logado,
      updateQueueStatus,
      offlinePhotos = null,
      localOnly = false,
      forceWrite = false,
      serverSinceTs = null,
      isManual = false,
    }) => {
      const now = new Date();
      const docId = normalizePatrimonioId(itemId);
      const unit = itemUnit?.id ? itemUnit : unidadeAtiva;
      const entryUnidadeId = unit?.id || "";
      const entryUnidadeNome = unit?.nome || "";
      const entry = {
        patrimonioId: docId,
        unidadeId: entryUnidadeId,
        unidadeNome: entryUnidadeNome,
        estado,
        situacao,
        localId,
        obs,
        marca: marca || "",
        origem: origem || "Próprio",
        fotoUrls,
        data: now.toLocaleDateString("pt-BR"),
        hora: now.toLocaleTimeString("pt-BR"),
        usuario: logado?.nome || "",
        email: logado?.email || "",
        ultimaAtualizacao: now.toISOString(),
        ultimoUsuarioAnterior: undefined,
        user: logado?.nome || "",
        ...(isManual ? { isManual: true } : {}),
        ...extras,
      };

      const currentFound = foundRef.current || [];
      const existing = currentFound.find((f) => normalizePatrimonioId(f.patrimonioId) === docId);
      if (existing) {
        const prevUser = existing.usuario || existing.user || "";
        const prevEmail = existing.email || "";
        const prevHora = existing.hora || "";
        entry.ultimoUsuarioAnterior = prevUser || undefined;
        if (prevEmail && prevEmail !== (logado?.email || "")) {
          showT?.(`Item já inventariado por ${prevUser || "outro usuário"}${prevHora ? ` em ${prevHora}` : ""}`);
        }
      }

      const applyLocal = async () => {
        const idx = foundPosRef.current.get(docId);
        const nextFound = currentFound.slice();
        const nextEntry = { ...entry, _id: docId };
        if (typeof idx === "number") nextFound[idx] = nextEntry;
        else nextFound.push(nextEntry);
        syncFoundRef(nextFound);
        bumpCacheBuster();
        await setCachedData("inventario", nextFound);
        return entry;
      };

      if (localOnly) {
        const saved = await applyLocal();
        return { conflict: false, entry: saved };
      }

      if (!navigator.onLine) {
        await queueOfflineWithPhotos({
          type: "save",
          data: {
            collection: "inventario",
            docId,
            content: entry,
            serverSinceTs: serverSinceTs || entry.ultimaAtualizacao,
          },
          photos: Array.isArray(offlinePhotos) ? offlinePhotos : null,
          uploadPrefix: docId,
        });
        updateQueueStatus?.();
        const saved = await applyLocal();
        return { conflict: false, entry: saved };
      }

      if (!forceWrite && navigator.onLine) {
        try {
          const server = await fsGetDoc("inventario", docId);
          if (server?.ultimaAtualizacao && serverSinceTs) {
            const serverMs = new Date(server.ultimaAtualizacao).getTime();
            const sinceMs = new Date(serverSinceTs).getTime();
            const serverEmail = String(server.email || "").trim();
            const myEmail = String(logado?.email || "").trim();
            if (serverMs > sinceMs && serverEmail && myEmail && serverEmail !== myEmail) {
              return { conflict: true, serverEntry: server };
            }
          }
        } catch {}
      }

      await fsSet("inventario", docId, entry);
      const saved = await applyLocal();
      return { conflict: false, entry: saved };
    },
    [showT, syncFoundRef]
  );

  const deleteFound = useCallback(
    async (itemId) => {
      const docId = normalizePatrimonioId(itemId);
      await fsDel("inventario", docId);
      const base = foundRef.current || [];
      const next = base.filter((f) => normalizePatrimonioId(f.patrimonioId) !== docId);
      syncFoundRef(next);
      bumpCacheBuster();
      await setCachedData("inventario", next);
    },
    [syncFoundRef]
  );

  const saveDetail = useCallback(
    async ({ formRef, getField, unidadeAtiva, itemUnit, logado, updateQueueStatus, closeModal, onConflict }) => {
      const item = formRef.current.detItem;
      if (!item) return;

      const unit = itemUnit?.id ? itemUnit : unidadeAtiva;

      const localId = String(getField("detLocal") || "").trim();
      if (!localId) {
        showT?.("Selecione um local antes de salvar");
        return;
      }

      perfMonitor.start("saveDetail");

      const before = getFoundEntry(item.id, foundMap) || null;
      const existingUrls = formRef.current.detExistingUrls || [];
      const newBase64 = formRef.current.detNewBase64 || [];
      let allUrls = [...existingUrls];

      const extras = {};
      const descEdit = String(formRef.current.detDescricao || "").trim();
      const espEdit = String(formRef.current.detEspecie || "").trim();
      if (descEdit) extras.descricaoEdit = descEdit;
      if (espEdit) extras.especieEdit = espEdit;

      const imeiVal = String(formRef.current.detImei || "").trim();
      if (imeiVal || before?.imei) extras.imei = imeiVal;
      extras.plaquetaAusente = !!formRef.current.detPlaquetaAusente;

      const situacaoAtual = getField("detSituacao") || "Em uso";
      if (situacaoAtual === "Permuta") {
        extras.permutaDesc = String(getField("detPermutaDesc") || "").trim();
        extras.permutaMarca = String(getField("detPermutaMarca") || "").trim();
        extras.permutaEstado = getField("detPermutaEstado") || "Bom";
      }

      if (before?.semTombo || item?.semTombo || before?.identificadoPorFoto) {
        extras.semTombo = true;
        extras.identificadoPorFoto = true;
        const tomboRef = String(formRef.current.detTomboRef || "").trim();
        if (tomboRef) extras.tomboReferencia = tomboRef;
      }

      try {
        let compressedBase64 = [];

        if (newBase64.length > 0) {
          setUploading(true);
          setUploadMsg("Comprimindo fotos...");
          compressedBase64 = await compressPhotoArray(newBase64, (done, total) => {
            setUploadMsg(`Comprimindo foto ${done}/${total}...`);
          });
        }

        const offlineEntry = {
          patrimonioId: item.id,
          unidadeId: unit?.id || item?.unidadeId || "",
          unidadeNome: unit?.nome || item?.unidadeNome || "",
          estado: getField("detEstado") || "Bom",
          situacao: situacaoAtual,
          localId: getField("detLocal"),
          obs: getField("detObs"),
          marca: getField("detMarca") || "",
          origem: getField("detOrigem") || "Próprio",
          fotoUrls: allUrls,
          data: new Date().toLocaleDateString("pt-BR"),
          hora: new Date().toLocaleTimeString("pt-BR"),
          usuario: logado?.nome || "",
          email: logado?.email || "",
          ultimaAtualizacao: new Date().toISOString(),
          user: logado?.nome || "",
          ...extras,
        };

        if (!navigator.onLine) {
          let photoOpId = null;
          if (newBase64.length > 0) {
            photoOpId = `ph_${item.id}_${Date.now()}`;
            await saveOfflinePhotos(photoOpId, newBase64);
          }
          await offlineManager.queueOperation("save", {
            collection: "inventario",
            docId: item.id,
            content: offlineEntry,
            photoOpId,
            serverSinceTs: formRef.current.detServerTs || before?.ultimaAtualizacao || null,
          });
          const base = foundRef.current || [];
          const idx = foundPosRef.current.get(item.id);
          const nextEntry = { ...offlineEntry, _id: item.id };
          const newFound = base.slice();
          if (typeof idx === "number") newFound[idx] = nextEntry;
          else newFound.push(nextEntry);
          syncFoundRef(newFound);
          updateQueueStatus?.();
          bumpCacheBuster();
          await setCachedData("inventario", newFound);
          await logAuditoria("queue-save", "inventario", item.id, before, offlineEntry);
          if (descEdit || espEdit) applyDescOverride?.(item.id, descEdit, espEdit);
          closeModal?.();
          showT?.(photoOpId ? "Na fila (offline)" : "Na fila (offline)");
          notificationService.notify(EVENTOS.ITEM_ENCONTRADO, { message: "Salvo na fila offline", type: "info" });
          return;
        }

        if (compressedBase64.length > 0 && isStorageOk()) {
          setUploadMsg("Enviando fotos...");
          try {
            const newUrls = await uploadPhotos(compressedBase64, item.id, (done, total) => {
              setUploadMsg(`Enviando foto ${done}/${total}...`);
            });
            allUrls = [...allUrls, ...newUrls];
            offlineEntry.fotoUrls = allUrls;
          } catch {
            showT?.("Fotos não foram salvas, mas o item foi registrado");
          }
        } else if (compressedBase64.length > 0) {
          showT?.("Firebase Storage não configurado — fotos não salvas");
        }

        const markResult = await markFound({
          itemId: item.id,
          estado: getField("detEstado") || "Bom",
          situacao: situacaoAtual,
          localId: getField("detLocal"),
          obs: getField("detObs"),
          marca: getField("detMarca"),
          origem: getField("detOrigem") || "Próprio",
          fotoUrls: allUrls,
          extras,
          unidadeAtiva: unit,
          itemUnit: unit,
          logado,
          forceWrite: !!formRef.current.detForceWrite,
          serverSinceTs: formRef.current.detServerTs || before?.ultimaAtualizacao || null,
        });

        if (markResult?.conflict) {
          onConflict?.(markResult.serverEntry);
          return;
        }

        const after = markResult?.entry;

        await logAuditoria("update", "inventario", item.id, before, after);
        if (descEdit || espEdit) applyDescOverride?.(item.id, descEdit, espEdit);

        notificationService.notify(EVENTOS.ITEM_ENCONTRADO, {
          message: `Item ${item.id} salvo com sucesso`,
          type: "success",
        });

        try {
          const olds = formRef.current.detNewBase64 || [];
          for (const s of olds) {
            const v = String(s || "");
            if (v.startsWith("blob:")) {
              try {
                URL.revokeObjectURL(v);
              } catch {}
            }
          }
          formRef.current.detNewBase64 = [];
        } catch {}

        closeModal?.();
        showT?.("Salvo com " + (allUrls.length > existingUrls.length ? "fotos" : "sucesso") + "!");
      } catch (e) {
        showT?.(e?.message || "Erro ao salvar");
      } finally {
        setUploading(false);
        setUploadMsg("");
        updateQueueStatus?.();
        perfMonitor.end("saveDetail");
      }
    },
    [applyDescOverride, foundMap, markFound, showT, syncFoundRef]
  );

  return {
    found,
    setFound,
    foundRef,
    foundSet,
    foundMap,
    tombosNE,
    setTombosNE,
    tombosDup,
    setTombosDup,
    uploading,
    uploadMsg,
    loadFoundAndTombos,
    markFound,
    saveDetail,
    deleteFound,
    deletePhoto,
  };
}

