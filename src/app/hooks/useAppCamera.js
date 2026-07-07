import React, { useEffect, useLayoutEffect } from "react";
import { buildFormSnapshot, buildItemSnapshot, clearUiResume, loadUiResume, saveUiResume } from "../../utils/uiResume.js";
import { defaultEstadoForItem } from "../../utils/itemHelpers.js";
import { pingInventoryPresence, getTeamMemberEditingItem } from "../../utils/inventoryPresence.js";
import { getFoundEntry, isItemInventariado } from "../../utils/patrimonioId.js";
import { getDisplayDesc, revokeRemovedBlobs, revokeBlobUrls } from "../helpers/appHelpers.js";

export function useAppCamera({ state, data }) {
  const {
    tab, modal, setModal, setCameraTarget, setTab, setOverlayBackdropSuppressMs,
    formRef, editingItemRef, resumeRestoredRef, cameraTargetRef, multiRowsPhotosRef,
    bumpFt, showT, cameraTarget,
  } = state;
  const {
    auth, found, inventario, unidades, unidadeAtiva, activeUnitIds,
    sortedFiltered, teamOnline,
  } = data;

  const saveSessionResume = React.useCallback(
    (patch = {}) => {
      const prev = loadUiResume() || {};
      const item = formRef.current.detItem;
      saveUiResume({
        modal: patch.modal ?? prev.modal ?? "detalhe",
        cameraTarget: patch.cameraTarget ?? cameraTargetRef.current ?? prev.cameraTarget ?? "detalhe",
        itemId: patch.itemId ?? item?.id ?? prev.itemId ?? "",
        itemSnapshot: patch.itemSnapshot ?? (item ? buildItemSnapshot(item) : prev.itemSnapshot ?? null),
        formSnapshot: patch.formSnapshot ?? buildFormSnapshot(formRef),
        unidadeId: patch.unidadeId ?? item?.unidadeId ?? unidadeAtiva?.id ?? prev.unidadeId ?? "",
        tab: patch.tab ?? tab,
        invSubTab: patch.invSubTab ?? inventario.invSubTab,
        pendingPhotos: patch.pendingPhotos ?? prev.pendingPhotos ?? [],
      });
    },
    [tab, inventario.invSubTab, unidadeAtiva?.id]
  );

  const persistCameraSession = React.useCallback(
    async (photos) => {
      const item = formRef.current.detItem;
      const serialized = [];
      for (const p of photos || []) {
        const s = String(p || "");
        if (!s) continue;
        if (s.startsWith("data:")) {
          serialized.push(s);
          continue;
        }
        if (s.startsWith("blob:")) {
          try {
            const blob = await fetch(s).then((r) => r.blob());
            const dataUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result || ""));
              reader.onerror = () => reject(new Error("read fail"));
              reader.readAsDataURL(blob);
            });
            if (dataUrl) serialized.push(dataUrl);
          } catch {}
        }
      }
      saveSessionResume({
        modal: serialized.length ? "detalhe" : "camera",
        cameraTarget: cameraTargetRef.current || "detalhe",
        pendingPhotos: serialized,
        itemSnapshot: item ? buildItemSnapshot(item) : undefined,
      });
    },
    [saveSessionResume]
  );

  const releaseEditingPresence = React.useCallback(() => {
    editingItemRef.current = null;
    if (!auth.logado?.uid || inventario.unidadesAtivas.length === 0) return;
    pingInventoryPresence({
      uid: auth.logado.uid,
      nome: auth.logado.nome,
      email: auth.logado.email,
      unidadeIds: activeUnitIds,
      itemEmEdicao: null,
      itemDescricao: "",
    }).catch(() => {});
  }, [auth.logado?.uid, auth.logado?.nome, auth.logado?.email, activeUnitIds, inventario.unidadesAtivas.length]);

  const closeDetModal = React.useCallback(() => {
    revokeBlobUrls(formRef.current.detNewBase64 || []);
    clearUiResume();
    releaseEditingPresence();
    setModal(null);
  }, [releaseEditingPresence]);

  const applyServerEntryToDetForm = React.useCallback(
    (serverEntry) => {
      const item = formRef.current.detItem;
      if (!item || !serverEntry) return;
      formRef.current.detEstado = serverEntry.estado || formRef.current.detEstado;
      formRef.current.detSituacao = serverEntry.situacao || formRef.current.detSituacao;
      formRef.current.detLocal = serverEntry.localId || formRef.current.detLocal;
      formRef.current.detObs = serverEntry.obs || "";
      formRef.current.detMarca = serverEntry.marca || item.marca || "";
      formRef.current.detOrigem = serverEntry.origem || formRef.current.detOrigem;
      formRef.current.detExistingUrls = serverEntry.fotoUrls || [];
      formRef.current.detNewBase64 = [];
      formRef.current.detDescricao = serverEntry.descricaoEdit || item.descricao || "";
      formRef.current.detEspecie = serverEntry.especieEdit || item.especie || "";
      formRef.current.detPermutaDesc = serverEntry.permutaDesc || "";
      formRef.current.detPermutaMarca = serverEntry.permutaMarca || "";
      formRef.current.detPermutaEstado = serverEntry.permutaEstado || "Bom";
      formRef.current.detTomboRef = serverEntry.tomboReferencia || "";
      formRef.current.detServerTs = serverEntry.ultimaAtualizacao || null;
      formRef.current.detServerEmail = serverEntry.email || "";
      formRef.current.detForceWrite = false;
      const nextFound = (found.foundRef.current || []).slice();
      const idx = nextFound.findIndex((f) => (f.patrimonioId || f._id) === item.id);
      const merged = { ...serverEntry, _id: item.id, patrimonioId: item.id };
      if (idx >= 0) nextFound[idx] = merged;
      else nextFound.push(merged);
      found.setFound(nextFound);
      bumpFt();
    },
    [found]
  );

  const openDetModal = (item, forceLocalId) => {
    const f = getFoundEntry(item.id, found.foundMap);
    const estadoDefault = f?.estado || defaultEstadoForItem(item);
    editingItemRef.current = item;
    if (auth.logado?.uid && inventario.unidadesAtivas.length > 0) {
      pingInventoryPresence({
        uid: auth.logado.uid,
        nome: auth.logado.nome,
        email: auth.logado.email,
        unidadeIds: activeUnitIds,
        itemEmEdicao: item.id,
        itemDescricao: getDisplayDesc(item, f),
      }).catch(() => {});
    }
    formRef.current = {
      detItem: item,
      detEstado: estadoDefault,
      detSituacao: f?.situacao || "Em uso",
      detLocal: typeof forceLocalId === "string" ? forceLocalId : f?.localId || inventario.activeLocalId || "",
      detObs: f?.obs || "",
      detMarca: f?.marca || item.marca || "",
      detOrigem: f?.origem || (item.isManual ? "Próprio" : item.tipoEntrada || "Próprio"),
      detOrigemLocked: !item.isManual,
      detExistingUrls: f?.fotoUrls || [],
      detNewBase64: [],
      detDescricao: f?.descricaoEdit || item.descricao || "",
      detEspecie: f?.especieEdit || item.especie || "",
      detPermutaDesc: f?.permutaDesc || "",
      detPermutaMarca: f?.permutaMarca || "",
      detPermutaEstado: f?.permutaEstado || "Bom",
      detTomboRef: f?.tomboReferencia || "",
      detImei: f?.imei || item.imei || "",
      detPlaquetaAusente: !!f?.plaquetaAusente,
      detServerTs: f?.ultimaAtualizacao || null,
      detServerEmail: f?.email || "",
      detForceWrite: false,
    };
    bumpFt();
    resumeRestoredRef.current = true;
    saveSessionResume({
      modal: "detalhe",
      cameraTarget: "detalhe",
      pendingPhotos: [],
      itemSnapshot: buildItemSnapshot(item),
    });
    setModal("detalhe");
  };

  const openNextPending = React.useCallback(() => {
    const myUid = auth.logado?.uid || "";
    const next = sortedFiltered.find((i) => {
      if (isItemInventariado(i.id, found.foundSet)) return false;
      return !getTeamMemberEditingItem(teamOnline, i.id, myUid);
    });
    if (!next) {
      showT("Nenhum item pendente nos filtros atuais (itens em uso por colegas são ignorados)");
      return;
    }
    openDetModal(next);
  }, [sortedFiltered, found.foundSet, showT, teamOnline, auth.logado?.uid]);

  const openCamera = (target) => {
    cameraTargetRef.current = target;
    resumeRestoredRef.current = true;
    saveSessionResume({
      modal: "camera",
      cameraTarget: target,
      pendingPhotos: [],
    });
    setCameraTarget(target);
    setModal("camera");
  };

  const ensureDetFormFromResume = (resume) => {
    if (formRef.current.detItem?.id) return;
    const snap = resume?.itemSnapshot;
    if (!snap?.id) return;
    const fs = resume?.formSnapshot || {};
    const f = getFoundEntry(snap.id, found.foundMap);
    formRef.current = {
      detItem: snap,
      detEstado: fs.detEstado || f?.estado || defaultEstadoForItem(snap),
      detSituacao: fs.detSituacao || f?.situacao || "Em uso",
      detLocal: fs.detLocal || f?.localId || inventario.activeLocalId || "",
      detObs: fs.detObs || f?.obs || "",
      detMarca: fs.detMarca || f?.marca || snap.marca || "",
      detOrigem: fs.detOrigem || f?.origem || (snap.isManual ? "Próprio" : snap.tipoEntrada || "Próprio"),
      detOrigemLocked: fs.detOrigemLocked ?? !snap.isManual,
      detExistingUrls: fs.detExistingUrls?.length ? fs.detExistingUrls : f?.fotoUrls || [],
      detNewBase64: formRef.current.detNewBase64 || [],
      detDescricao: fs.detDescricao || f?.descricaoEdit || snap.descricao || "",
      detEspecie: fs.detEspecie || f?.especieEdit || snap.especie || "",
      detPermutaDesc: fs.detPermutaDesc || f?.permutaDesc || "",
      detPermutaMarca: fs.detPermutaMarca || f?.permutaMarca || "",
      detPermutaEstado: fs.detPermutaEstado || f?.permutaEstado || "Bom",
      detTomboRef: fs.detTomboRef || f?.tomboReferencia || "",
      detImei: fs.detImei || f?.imei || "",
      detPlaquetaAusente: fs.detPlaquetaAusente ?? !!f?.plaquetaAusente,
      detServerTs: f?.ultimaAtualizacao || null,
      detServerEmail: f?.email || "",
      detForceWrite: false,
    };
    if (formRef.current.detItem) editingItemRef.current = formRef.current.detItem;
  };

  const onCameraCapture = async (photoArray) => {
    const resume = loadUiResume();
    const target = cameraTargetRef.current || resume?.cameraTarget || "detalhe";
    ensureDetFormFromResume(resume);
    const incoming = Array.isArray(photoArray) ? photoArray : [];

    if (target.startsWith("multi-row-")) {
      const idx = target.slice("multi-row-".length);
      const prev = multiRowsPhotosRef.current[idx] || [];
      revokeRemovedBlobs(prev, incoming);
      multiRowsPhotosRef.current[idx] = incoming;
      cameraTargetRef.current = null;
      setCameraTarget(null);
      setOverlayBackdropSuppressMs(1200);
      setModal("multi");
      bumpFt();
      return;
    }

    if (target === "manual") {
      revokeRemovedBlobs(formRef.current.manPhotos, incoming);
      formRef.current.manPhotos = incoming;
    } else if (target === "semTombo") {
      revokeRemovedBlobs(formRef.current.stPhotos, incoming);
      formRef.current.stPhotos = incoming;
      cameraTargetRef.current = null;
      setCameraTarget(null);
      setOverlayBackdropSuppressMs(1200);
      setModal("semTombo");
      bumpFt();
      return;
    } else {
      revokeRemovedBlobs(formRef.current.detNewBase64, incoming);
      formRef.current.detNewBase64 = incoming;
    }

    cameraTargetRef.current = null;
    setCameraTarget(null);
    setOverlayBackdropSuppressMs(1200);
    resumeRestoredRef.current = true;
    setModal(target === "manual" ? "manual" : "detalhe");
    bumpFt();

    const photos = target === "manual" ? formRef.current.manPhotos : formRef.current.detNewBase64;
    await persistCameraSession(photos);
    bumpFt();
  };

  const closeCameraModal = () => {
    const target = cameraTargetRef.current || cameraTarget;
    cameraTargetRef.current = null;
    setCameraTarget(null);
    setOverlayBackdropSuppressMs(1200);
    ensureDetFormFromResume(loadUiResume());
    setModal(target === "manual" ? "manual" : target === "semTombo" ? "semTombo" : formRef.current.detItem ? "detalhe" : null);
    bumpFt();
    if (!formRef.current.detItem) clearUiResume();
  };

  const applyUiResume = React.useCallback(
    (resume) => {
      if (!resume?.itemId && !resume?.itemSnapshot?.id) return false;

      let item = resume.itemSnapshot?.id ? resume.itemSnapshot : null;
      if (!item && unidades.length > 0) {
        for (const u of unidades) {
          const hit = u.itens.find((i) => i.id === resume.itemId || i.patrimonioLabel === resume.itemId);
          if (hit) {
            item = { ...hit, unidadeId: u.id, unidadeNome: u.nome };
            break;
          }
        }
      }
      if (!item?.id) return false;

      if (resume.tab) setTab(resume.tab);
      if (resume.invSubTab) inventario.setInvSubTab(resume.invSubTab);

      const fs = resume.formSnapshot || {};
      const f = found.foundMap[item.id];
      const pending = Array.isArray(resume.pendingPhotos) ? resume.pendingPhotos : [];
      const existingNew = formRef.current.detNewBase64 || [];
      const restoredPhotos =
        pending.length > 0
          ? pending
          : existingNew.length > 0
            ? existingNew
            : [];

      formRef.current = {
        detItem: item,
        detEstado: fs.detEstado || f?.estado || defaultEstadoForItem(item),
        detSituacao: fs.detSituacao || f?.situacao || "Em uso",
        detLocal: fs.detLocal || f?.localId || inventario.activeLocalId || "",
        detObs: fs.detObs || f?.obs || "",
        detMarca: fs.detMarca || f?.marca || item.marca || "",
        detOrigem: fs.detOrigem || f?.origem || (item.isManual ? "Próprio" : item.tipoEntrada || "Próprio"),
        detOrigemLocked: fs.detOrigemLocked ?? !item.isManual,
        detExistingUrls: fs.detExistingUrls?.length ? fs.detExistingUrls : f?.fotoUrls || [],
        detNewBase64: resume.cameraTarget === "manual" ? [] : restoredPhotos,
        detDescricao: fs.detDescricao || f?.descricaoEdit || item.descricao || "",
        detEspecie: fs.detEspecie || f?.especieEdit || item.especie || "",
        detPermutaDesc: fs.detPermutaDesc || f?.permutaDesc || "",
        detPermutaMarca: fs.detPermutaMarca || f?.permutaMarca || "",
        detPermutaEstado: fs.detPermutaEstado || f?.permutaEstado || "Bom",
        detTomboRef: fs.detTomboRef || f?.tomboReferencia || "",
        detImei: fs.detImei || f?.imei || "",
        detPlaquetaAusente: fs.detPlaquetaAusente ?? !!f?.plaquetaAusente,
        detServerTs: f?.ultimaAtualizacao || null,
        detServerEmail: f?.email || "",
        detForceWrite: false,
      };
      editingItemRef.current = item;

      if (pending.length && resume.cameraTarget === "manual") {
        formRef.current.manPhotos = pending;
      }

      const reopenCamera = resume.modal === "camera" && !pending.length;
      if (reopenCamera) {
        cameraTargetRef.current = resume.cameraTarget || "detalhe";
        setCameraTarget(resume.cameraTarget || "detalhe");
        setModal("camera");
      } else {
        setModal(resume.cameraTarget === "manual" ? "manual" : "detalhe");
      }
      bumpFt();
      return true;
    },
    [unidades, found.foundMap, inventario.setInvSubTab]
  );

  const tryRestoreUi = React.useCallback(() => {
    if (!auth.logado || resumeRestoredRef.current) return;
    const resume = loadUiResume();
    if (!resume?.itemId && !resume?.itemSnapshot?.id) return;
    if (applyUiResume(resume)) resumeRestoredRef.current = true;
  }, [auth.logado, applyUiResume]);

  React.useLayoutEffect(() => {
    tryRestoreUi();
  }, [tryRestoreUi]);

  useEffect(() => {
    const onPageShow = () => tryRestoreUi();
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [tryRestoreUi]);

  useEffect(() => {
    const persistOnHide = () => {
      if (modal !== "camera" && modal !== "detalhe" && modal !== "manual") return;
      saveSessionResume({
        modal,
        cameraTarget: cameraTargetRef.current || "detalhe",
      });
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") persistOnHide();
    };
    window.addEventListener("pagehide", persistOnHide);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", persistOnHide);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [modal, saveSessionResume]);

  useEffect(() => {
    if (!auth.logado?.uid || resumeRestoredRef.current) return;
    tryRestoreUi();
  }, [auth.logado?.uid, unidades, found.foundMap, tryRestoreUi]);

  return { saveSessionResume, persistCameraSession, releaseEditingPresence,
    closeDetModal, applyServerEntryToDetForm, openDetModal, openNextPending,
    openCamera, onCameraCapture, closeCameraModal };
}
