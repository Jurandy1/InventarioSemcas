import React, { useRef, useState } from "react";
import { useIsMobile } from "../../hooks/useIsMobile.js";

export function useAppState() {
  const isMob = useIsMobile();
  const [tab, setTab] = useState("inventario");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [coordRegistroLink, setCoordRegistroLink] = useState("");
  const [invConviteLink, setInvConviteLink] = useState("");
  const [invConviteExp, setInvConviteExp] = useState("");
  const [gerandoInvConvite, setGerandoInvConvite] = useState(false);
  const [localDetalhe, setLocalDetalhe] = useState(null);
  const [cameraTarget, setCameraTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hideFound, setHideFound] = useState(true);
  const [hideIncorporados, setHideIncorporados] = useState(() => {
    try {
      const v = localStorage.getItem("inv-hide-incorporados");
      return v === null ? true : v === "1";
    } catch {
      return true;
    }
  });

  const persistHideIncorporados = React.useCallback((next) => {
    setHideIncorporados(next);
    try {
      localStorage.setItem("inv-hide-incorporados", next ? "1" : "0");
    } catch {}
  }, []);
  const [tombosTab, setTombosTab] = useState("ne");
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalResults, setGlobalResults] = useState([]);
  const [globalSearching, setGlobalSearching] = useState(false);
  const [nfSearch, setNfSearch] = useState("");
  const [nfTipo, setNfTipo] = useState("Todos");
  const [nfPage, setNfPage] = useState(1);
  const [ft, setFt] = useState(0);
  const [imgViewSrc, setImgViewSrc] = useState(null);
  const [overlayBackdropSuppressMs, setOverlayBackdropSuppressMs] = useState(0);
  const [teamOnline, setTeamOnline] = useState([]);
  const [saveConflict, setSaveConflict] = useState(null);
  const [finalizadoEdit, setFinalizadoEdit] = useState(null);

  const formRef = useRef({});
  const editingItemRef = useRef(null);
  const manualPatrimonioRef = useRef(null);
  const resumeRestoredRef = useRef(false);
  const cameraTargetRef = useRef(null);
  const multiRowsPhotosRef = useRef({});
  const multiSharedRef = useRef(null);
  const multiRowsRef = useRef(null);
  const finalizandoRef = useRef(false);

  const bumpFt = () => setFt((t) => t + 1);
  const setField = (k, v) => {
    formRef.current[k] = v;
  };
  const getField = (k) => formRef.current[k] || "";
  const showT = React.useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const onViewImage = React.useCallback((src) => {
    const s = String(src || "");
    if (!s) return;
    setImgViewSrc(s);
  }, []);

  return { tab, setTab, busy, setBusy, isMob, toast, setToast, modal, setModal,
    qrCodeUrl, setQrCodeUrl, coordRegistroLink, setCoordRegistroLink,
    invConviteLink, setInvConviteLink, invConviteExp, setInvConviteExp,
    gerandoInvConvite, setGerandoInvConvite, localDetalhe, setLocalDetalhe,
    cameraTarget, setCameraTarget, search, setSearch, page, setPage,
    hideFound, setHideFound, hideIncorporados, persistHideIncorporados,
    tombosTab, setTombosTab, globalSearch, setGlobalSearch, globalResults, setGlobalResults,
    globalSearching, setGlobalSearching, nfSearch, setNfSearch, nfTipo, setNfTipo,
    nfPage, setNfPage, ft, setFt, imgViewSrc, setImgViewSrc,
    overlayBackdropSuppressMs, setOverlayBackdropSuppressMs,
    teamOnline, setTeamOnline, saveConflict, setSaveConflict,
    finalizadoEdit, setFinalizadoEdit,
    formRef, editingItemRef, manualPatrimonioRef, resumeRestoredRef,
    cameraTargetRef, multiRowsPhotosRef, multiSharedRef, multiRowsRef, finalizandoRef,
    bumpFt, setField, getField, showT, onViewImage };
}
