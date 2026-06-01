import { useCallback, useMemo, useRef, useState } from "react";
import { fsDel, fsGetAll, fsSet } from "../services/firebase.js";
import { deletePhoto, isStorageOk, uploadPhotos } from "../services/storage.js";
import { EVENTOS, notificationService, offlineManager } from "../services/features.js";
import { logAuditoria } from "../services/audit.js";
import { bumpCacheBuster, compressPhotoArray, getCachedData, perfMonitor, setCachedData } from "../utils/performance.js";

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
      foundRef.current = next;
      foundPosRef.current = new Map(next.map((f, idx) => [f.patrimonioId, idx]));
      setFound(next);
    },
    [setFound]
  );

  const foundSet = useMemo(() => new Set(found.map((f) => f.patrimonioId)), [found]);
  const foundMap = useMemo(() => found.reduce((m, f) => ((m[f.patrimonioId] = f), m), {}), [found]);

  const loadFoundAndTombos = useCallback(async () => {
    try {
      const [cachedFound, cachedTombos] = await Promise.all([getCachedData("inventario"), getCachedData("tombosNE")]);
      if (Array.isArray(cachedFound) && cachedFound.length > 0) syncFoundRef(cachedFound);
      if (Array.isArray(cachedTombos) && cachedTombos.length > 0) setTombosNE(cachedTombos);

      const [foundDocs, neDocs] = await Promise.all([fsGetAll("inventario"), fsGetAll("tombosNE")]);
      const nextFound = foundDocs.map((d) => ({ ...d, patrimonioId: d.patrimonioId || d._id }));
      const nextTombos = neDocs.map((d) => ({ ...d, id: d._id }));

      syncFoundRef(nextFound);
      setTombosNE(nextTombos);

      await Promise.all([setCachedData("inventario", nextFound), setCachedData("tombosNE", nextTombos)]);
      return { found: nextFound, tombosNE: nextTombos };
    } catch {
      return { found: [], tombosNE: [] };
    }
  }, [syncFoundRef]);

  const markFound = useCallback(
    async ({ itemId, estado, situacao, localId, obs, marca, origem, fotoUrls = [], extras = {}, unidadeAtiva, logado }) => {
      const now = new Date();
      const entryUnidadeId = unidadeAtiva?.id || "";
      const entryUnidadeNome = unidadeAtiva?.nome || "";
      const entry = {
        patrimonioId: itemId,
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
        ...extras,
      };

      const currentFound = foundRef.current || [];
      const existing = currentFound.find((f) => f.patrimonioId === itemId);
      if (existing) {
        const prevUser = existing.usuario || existing.user || "";
        const prevEmail = existing.email || "";
        const prevHora = existing.hora || "";
        entry.ultimoUsuarioAnterior = prevUser || undefined;
        if (prevEmail && prevEmail !== (logado?.email || "")) {
          showT?.(`⚠️ Item já inventariado por ${prevUser || "outro usuário"}${prevHora ? ` em ${prevHora}` : ""}`);
        }
      }

      await fsSet("inventario", itemId, entry);
      const idx = foundPosRef.current.get(itemId);
      const nextFound = currentFound.slice();
      const nextEntry = { ...entry, _id: itemId };
      if (typeof idx === "number") nextFound[idx] = nextEntry;
      else nextFound.push(nextEntry);
      syncFoundRef(nextFound);
      bumpCacheBuster();
      await setCachedData("inventario", nextFound);
      return entry;
    },
    [showT, syncFoundRef]
  );

  const deleteFound = useCallback(
    async (itemId) => {
      await fsDel("inventario", itemId);
      const base = foundRef.current || [];
      const next = base.filter((f) => f.patrimonioId !== itemId);
      syncFoundRef(next);
      bumpCacheBuster();
      await setCachedData("inventario", next);
    },
    [syncFoundRef]
  );

  const saveDetail = useCallback(
    async ({ formRef, getField, unidadeAtiva, logado, updateQueueStatus, closeModal }) => {
      const item = formRef.current.detItem;
      if (!item) return;

      perfMonitor.start("saveDetail");

      const before = foundMap[item.id] || null;
      const existingUrls = formRef.current.detExistingUrls || [];
      const newBase64 = formRef.current.detNewBase64 || [];
      let allUrls = [...existingUrls];

      const extras = {};
      const descEdit = String(formRef.current.detDescricao || "").trim();
      const espEdit = String(formRef.current.detEspecie || "").trim();
      if (descEdit) extras.descricaoEdit = descEdit;
      if (espEdit) extras.especieEdit = espEdit;

      const situacaoAtual = getField("detSituacao") || "Em uso";
      if (situacaoAtual === "Permuta") {
        extras.permutaDesc = String(getField("detPermutaDesc") || "").trim();
        extras.permutaMarca = String(getField("detPermutaMarca") || "").trim();
        extras.permutaEstado = getField("detPermutaEstado") || "Bom";
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
          unidadeId: unidadeAtiva?.id || item?.unidadeId || "",
          unidadeNome: unidadeAtiva?.nome || item?.unidadeNome || "",
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
          await offlineManager.queueOperation("save", {
            collection: "inventario",
            docId: item.id,
            content: offlineEntry,
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
          showT?.("✓ Salvo offline (sincronizará quando voltar online)");
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
            showT?.("⚠️ Fotos não foram salvas, mas o item foi registrado");
          }
        } else if (compressedBase64.length > 0) {
          showT?.("⚠️ Firebase Storage não configurado — fotos não salvas");
        }

        const after = await markFound({
          itemId: item.id,
          estado: getField("detEstado") || "Bom",
          situacao: situacaoAtual,
          localId: getField("detLocal"),
          obs: getField("detObs"),
          marca: getField("detMarca"),
          origem: getField("detOrigem") || "Próprio",
          fotoUrls: allUrls,
          extras,
          unidadeAtiva,
          logado,
        });

        await logAuditoria("update", "inventario", item.id, before, after);
        if (descEdit || espEdit) applyDescOverride?.(item.id, descEdit, espEdit);

        notificationService.notify(EVENTOS.ITEM_ENCONTRADO, {
          message: `Item ${item.id} salvo com sucesso`,
          type: "success",
        });

        closeModal?.();
        showT?.("✓ Salvo com " + (allUrls.length > existingUrls.length ? "fotos" : "sucesso") + "!");
      } catch (e) {
        showT?.("⚠️ " + (e?.message || "Erro ao salvar"));
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

