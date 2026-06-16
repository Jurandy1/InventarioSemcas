import React, { useEffect, useRef, useState } from "react";

function canvasToJpegObjectUrl(canvas, quality = 0.8) {
  return new Promise((resolve) => {
    try {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(dataUrl);
    } catch {
      try {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve("");
              return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => resolve("");
            reader.readAsDataURL(blob);
          },
          "image/jpeg",
          quality
        );
      } catch {
        resolve("");
      }
    }
  });
}

function isLocalHost() {
  if (typeof window === "undefined") return false;
  const host = String(window.location.hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

function canUseLiveCamera() {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  if (!window.isSecureContext && !isLocalHost()) return false;
  return !!resolveGetUserMedia();
}

function resolveGetUserMedia() {
  if (typeof navigator === "undefined") return null;
  if (navigator.mediaDevices?.getUserMedia) {
    return (constraints) => navigator.mediaDevices.getUserMedia(constraints);
  }
  const legacy =
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia;
  if (!legacy) return null;
  return (constraints) =>
    new Promise((resolve, reject) => {
      legacy.call(navigator, constraints, resolve, reject);
    });
}

async function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."));
    r.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Formato de imagem não suportado. Tente JPG ou PNG."));
      img.onload = () => {
        try {
          const maxW = 1600;
          const maxH = 1200;
          let w = img.width;
          let h = img.height;
          if (w > maxW) {
            h = h * (maxW / w);
            w = maxW;
          }
          if (h > maxH) {
            w = w * (maxH / h);
            h = maxH;
          }
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(w));
          c.height = Math.max(1, Math.round(h));
          const ctx = c.getContext("2d");
          if (!ctx) {
            reject(new Error("Não foi possível processar a imagem."));
            return;
          }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, c.width, c.height);
          canvasToJpegObjectUrl(c, 0.8).then(resolve).catch(reject);
        } catch (err) {
          reject(err instanceof Error ? err : new Error("Erro ao comprimir imagem."));
        }
      };
      img.src = e.target.result;
    };
    r.readAsDataURL(file);
  });
}

export function CameraModal({ onCapture, onClose, existingPhotos = [], onPhotosChange, onBeforeNativeCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const aliveRef = useRef(true);
  const startSeqRef = useRef(0);
  const acceptingRef = useRef(false);
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState("environment");
  const [flashOn, setFlashOn] = useState(false);
  const [preview, setPreview] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [captured, setCaptured] = useState([...existingPhotos]);
  const capturedRef = useRef([...existingPhotos]);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [camError, setCamError] = useState("");
  const [useNativeCapture, setUseNativeCapture] = useState(() => !canUseLiveCamera());
  const MAX_FILE_BYTES = 8 * 1024 * 1024;

  const handleVideoRef = React.useCallback((node) => {
    videoRef.current = node;
    if (node && streamRef.current && node.srcObject !== streamRef.current) {
      node.srcObject = streamRef.current;
      node.play().catch(() => {});
    }
  }, []);

  const stopStream = () => {
    const s = streamRef.current;
    if (s) {
      try {
        s.getTracks().forEach((t) => t.stop());
      } catch {}
    }
    streamRef.current = null;
    setStream(null);
  };

  const explainCameraError = (err) => {
    const name = err?.name || "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") return "Permissão da câmera negada. Libere o acesso nas configurações do navegador.";
    if (name === "NotFoundError" || name === "DevicesNotFoundError") return "Nenhuma câmera foi encontrada neste dispositivo.";
    if (name === "NotReadableError" || name === "TrackStartError") return "Não foi possível iniciar a câmera. Feche outros apps que estejam usando a câmera e tente novamente.";
    if (name === "OverconstrainedError") return "A câmera não suporta as configurações solicitadas. Tente alternar a câmera.";
    if (name === "SecurityError") return "A câmera só funciona em conexão segura (HTTPS) ou em localhost.";
    if (name === "AbortError") return "A inicialização da câmera foi interrompida. Tente novamente.";
    return err?.message ? `Falha ao iniciar a câmera: ${err.message}` : "Falha ao iniciar a câmera.";
  };

  const startCamera = async (facing) => {
    const seq = ++startSeqRef.current;
    if (aliveRef.current) setCamError("");
    stopStream();

    const getUserMedia = resolveGetUserMedia();
    if (!getUserMedia || (!window.isSecureContext && !isLocalHost())) {
      if (aliveRef.current && seq === startSeqRef.current) {
        setUseNativeCapture(true);
        if (!window.isSecureContext && !isLocalHost()) {
          setCamError(
            "A câmera ao vivo exige HTTPS. Use os botões abaixo para tirar foto ou escolher da galeria — funciona normalmente no celular."
          );
        } else {
          setCamError("Este navegador não abre a câmera ao vivo. Use os botões abaixo para tirar foto ou escolher da galeria.");
        }
      }
      return;
    }

    try {
      let s;
      try {
        s = await getUserMedia({
          video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
      } catch (firstErr) {
        if (firstErr?.name === "OverconstrainedError" || facing === "environment") {
          s = await getUserMedia({ video: true });
        } else {
          throw firstErr;
        }
      }

      if (!aliveRef.current || seq !== startSeqRef.current) {
        try {
          s.getTracks().forEach((t) => t.stop());
        } catch {}
        return;
      }
      streamRef.current = s;
      setStream(s);
      setUseNativeCapture(false);
      setCamError("");
      if (videoRef.current) {
        if (videoRef.current.srcObject !== s) {
          videoRef.current.srcObject = s;
          try {
            await videoRef.current.play();
          } catch {}
        }
      }
      const track = s.getVideoTracks()[0];
      if (track?.getCapabilities) {
        try {
          const caps = track.getCapabilities();
          if (caps?.torch) {
            await track.applyConstraints({ advanced: [{ torch: flashOn }] });
          }
        } catch {}
      }
    } catch (e) {
      if (aliveRef.current && seq === startSeqRef.current) {
        setUseNativeCapture(true);
        setCamError(`${explainCameraError(e)} Você pode tirar foto pelo botão abaixo.`);
      }
      stopStream();
    }
  };

  useEffect(() => {
    capturedRef.current = captured;
  }, [captured]);

  useEffect(() => {
    aliveRef.current = true;
    if (canUseLiveCamera()) {
      startCamera(facingMode);
    } else {
      setUseNativeCapture(true);
      if (!window.isSecureContext && !isLocalHost()) {
        setCamError(
          "A câmera ao vivo exige HTTPS. Use os botões abaixo para tirar foto ou escolher da galeria — funciona normalmente no celular."
        );
      } else {
        setCamError("Use os botões abaixo para tirar foto ou escolher da galeria.");
      }
    }
    return () => {
      aliveRef.current = false;
      startSeqRef.current++;
      stopStream();
    };
  }, []);

  const toggleFlash = async () => {
    const newFlash = !flashOn;
    setFlashOn(newFlash);
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks?.()[0];
      try {
        await track?.applyConstraints?.({ advanced: [{ torch: newFlash }] });
      } catch {}
    }
  };

  const flipCamera = () => {
    const newFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newFacing);
    startCamera(newFacing);
  };

  const takePhoto = () => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    if (!v.videoWidth || !v.videoHeight) {
      setCamError("Aguarde a câmera carregar completamente antes de tirar a foto.");
      return;
    }
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    ctx.drawImage(v, 0, 0);
    const maxW = 1600;
    const maxH = 1200;
    let w = c.width;
    let h = c.height;
    if (w > maxW || h > maxH) {
      const sc = Math.min(maxW / w, maxH / h);
      const c2 = document.createElement("canvas");
      c2.width = w * sc;
      c2.height = h * sc;
      c2.getContext("2d").drawImage(c, 0, 0, c2.width, c2.height);
      canvasToJpegObjectUrl(c2, 0.8).then(setPreview);
    } else {
      canvasToJpegObjectUrl(c, 0.8).then(setPreview);
    }
  };

  const acceptPhoto = () => {
    if (acceptingRef.current || !preview) return;
    acceptingRef.current = true;
    const snapshot = preview;
    setCaptured((arr) => {
      if (arr.includes(snapshot)) return arr;
      const next = [...arr, snapshot];
      persistPhotos(next);
      return next;
    });
    setPreview(null);
    setTimeout(() => {
      acceptingRef.current = false;
    }, 350);
  };

  const retakePhoto = () => {
    const p = preview;
    if (p && !captured.includes(p) && String(p).startsWith("blob:")) {
      try {
        URL.revokeObjectURL(String(p));
      } catch {}
    }
    setPreview(null);
  };

  const persistPhotos = (photos) => {
    onPhotosChange?.(photos);
  };

  const flushPersist = (photos) => {
    persistPhotos(photos);
  };

  const openNativeCamera = () => {
    onBeforeNativeCapture?.();
    flushPersist(captured);
    cameraInputRef.current?.click();
  };

  const openGallery = () => {
    flushPersist(captured);
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e, source = "gallery") => {
    const f = e.target.files?.[0];
    e.target.value = null;
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      setCamError(`Arquivo muito grande (${Math.round(f.size / (1024 * 1024))}MB). Selecione até 8MB.`);
      return;
    }
    try {
      setCamError("");
      const d = await compressPhoto(f);
      setPreview(d);
    } catch (err) {
      setCamError(err?.message || "Erro ao processar a foto. Tente outra imagem.");
    }
  };

  const finishCapture = (photos) => {
    stopStream();
    if (String(preview || "").startsWith("blob:")) {
      try {
        URL.revokeObjectURL(String(preview));
      } catch {}
    }
    onCapture(Array.isArray(photos) ? photos : captured);
  };

  const done = () => finishCapture(captured);

  const cancel = () => {
    stopStream();
    if (String(preview || "").startsWith("blob:")) {
      try {
        URL.revokeObjectURL(String(preview));
      } catch {}
    }
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 400, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "rgba(0,0,0,.8)", zIndex: 1 }}>
        <button onClick={cancel} style={{ background: "none", border: "none", color: "#fff", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
        <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>{captured.length} foto(s)</span>
        {!useNativeCapture && stream ? (
          <button onClick={toggleFlash} style={{ background: flashOn ? "#fbbf24" : "rgba(255,255,255,.2)", border: "none", color: flashOn ? "#000" : "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Flash: {flashOn ? "ON" : "OFF"}</button>
        ) : (
          <span style={{ width: 72 }} />
        )}
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
        {viewing ? (
          <img src={viewing} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        ) : preview ? (
          <img src={preview} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        ) : useNativeCapture || !stream ? (
          <div style={{ textAlign: "center", padding: 24, color: "#fff", maxWidth: 320 }}>
            <p style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800 }}>Adicionar fotos</p>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
              Toque em <strong>Tirar foto</strong> para abrir a câmera do celular, ou em <strong>Galeria</strong> para escolher uma imagem existente.
            </p>
            {captured.length > 0 && (
              <p style={{ margin: "12px 0 0", fontSize: 12, color: "#86efac", fontWeight: 700 }}>
                {captured.length} foto(s) pronta(s) — toque Concluir quando terminar.
              </p>
            )}
          </div>
        ) : (
          <video
            ref={handleVideoRef}
            autoPlay
            playsInline
            muted
            webkit-playsinline="true"
            style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000" }}
          />
        )}
        {!preview && !useNativeCapture && stream && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ width: "80%", maxWidth: 300, aspectRatio: "4/3", border: "2px solid rgba(255,255,255,.3)", borderRadius: 12 }} />
          </div>
        )}
      </div>

      {captured.length > 0 && (
        <div style={{ display: "flex", gap: 6, padding: "8px 16px", background: "rgba(0,0,0,.8)", overflowX: "auto" }}>
          {captured.map((ph, i) => (
            <div key={i} style={{ position: "relative", flexShrink: 0 }}>
              <img 
                src={ph} 
                alt="" 
                style={{ width: 48, height: 48, borderRadius: 6, objectFit: "cover", border: "2px solid #fff", cursor: "pointer" }} 
                loading="lazy" 
                decoding="async" 
                onClick={() => setViewing(ph)}
              />
              <button
                onClick={() => {
                  const old = captured[i];
                  if (String(old || "").startsWith("blob:")) {
                    try {
                      URL.revokeObjectURL(String(old));
                    } catch {}
                  }
                  setCaptured((p) => {
                    const next = p.filter((_, j) => j !== i);
                    persistPhotos(next);
                    return next;
                  });
                }}
                style={{ position: "absolute", top: -4, right: -4, background: "#dc2626", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", padding: "16px", background: "rgba(0,0,0,.9)" }}>
        {viewing ? (
          <button onClick={() => setViewing(null)} style={{ background: "rgba(255,255,255,.2)", border: "none", color: "#fff", borderRadius: 12, padding: "12px 24px", fontSize: 14, cursor: "pointer", fontWeight: 700 }}>
            Voltar
          </button>
        ) : preview ? (
          <>
            <button onClick={retakePhoto} style={{ background: "rgba(255,255,255,.2)", border: "none", color: "#fff", borderRadius: 12, padding: "12px 24px", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>Refazer</button>
            <button
              onClick={acceptPhoto}
              disabled={acceptingRef.current}
              style={{ background: "#16a34a", border: "none", color: "#fff", borderRadius: 12, padding: "12px 24px", fontSize: 14, cursor: "pointer", fontWeight: 700, opacity: acceptingRef.current ? 0.6 : 1 }}
            >
              Usar foto
            </button>
          </>
        ) : useNativeCapture || !stream ? (
          <>
            <button
              onClick={openGallery}
              style={{ flex: 1, background: "rgba(255,255,255,.2)", border: "none", color: "#fff", borderRadius: 12, padding: "14px 12px", fontSize: 14, cursor: "pointer", fontWeight: 700 }}
            >
              Galeria
            </button>
            <button
              onClick={openNativeCamera}
              style={{ flex: 1, background: "#fff", border: "none", color: "#0f172a", borderRadius: 12, padding: "14px 12px", fontSize: 14, cursor: "pointer", fontWeight: 800 }}
            >
              Tirar foto
            </button>
          </>
        ) : (
          <>
            <button onClick={openGallery} style={{ background: "rgba(255,255,255,.2)", border: "none", color: "#fff", borderRadius: 12, padding: "10px 14px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>Galeria</button>
            <button onClick={takePhoto} style={{ background: "#fff", border: "4px solid rgba(255,255,255,.3)", borderRadius: "50%", width: 72, height: 72, cursor: "pointer" }}>
              <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "#fff" }} />
            </button>
            <button onClick={flipCamera} style={{ background: "rgba(255,255,255,.2)", border: "none", color: "#fff", borderRadius: 12, padding: "10px 14px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>Trocar</button>
          </>
        )}
      </div>

      {camError && (
        <div style={{ margin: "0 16px 16px", background: "rgba(0,0,0,.7)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 12, padding: 12, color: "#fff" }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>{useNativeCapture ? "Como adicionar fotos" : "Erro ao acessar câmera"}</div>
          <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 10 }}>{camError}</div>
          <div style={{ display: "flex", gap: 8 }}>
            {!useNativeCapture && canUseLiveCamera() && (
              <button onClick={() => startCamera(facingMode)} style={{ background: "#1351B4", color: "#fff", border: "none", borderRadius: 10, padding: "10px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Tentar novamente
              </button>
            )}
            <button onClick={openNativeCamera} style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 10, padding: "10px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Tirar foto
            </button>
            <button onClick={openGallery} style={{ background: "rgba(255,255,255,.18)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Galeria
            </button>
          </div>
        </div>
      )}

      {captured.length > 0 && !preview && !viewing && (
        <button onClick={done} style={{ margin: "0 16px 16px", background: "#1351B4", color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          Concluir ({captured.length} foto{captured.length > 1 ? "s" : ""})
        </button>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFileSelect(e, "gallery")} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => handleFileSelect(e, "camera")} />
    </div>
  );
}

