import React, { useEffect, useRef, useState } from "react";

async function compressPhoto(file) {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 1200;
        const maxH = 900;
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
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        res(c.toDataURL("image/jpeg", 0.62));
      };
      img.src = e.target.result;
    };
    r.readAsDataURL(file);
  });
}

export function CameraModal({ onCapture, onClose, existingPhotos = [] }) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState("environment");
  const [flashOn, setFlashOn] = useState(false);
  const [preview, setPreview] = useState(null);
  const [captured, setCaptured] = useState([...existingPhotos]);
  const fileInputRef = useRef(null);

  const startCamera = async (facing) => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
      const track = s.getVideoTracks()[0];
      if (track.getCapabilities && track.getCapabilities().torch) {
        await track.applyConstraints({ advanced: [{ torch: flashOn }] });
      }
    } catch {}
  };

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const toggleFlash = async () => {
    const newFlash = !flashOn;
    setFlashOn(newFlash);
    if (stream) {
      const track = stream.getVideoTracks()[0];
      try {
        await track.applyConstraints({ advanced: [{ torch: newFlash }] });
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
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    ctx.drawImage(v, 0, 0);
    const maxW = 1200;
    const maxH = 900;
    let w = c.width;
    let h = c.height;
    if (w > maxW || h > maxH) {
      const sc = Math.min(maxW / w, maxH / h);
      const c2 = document.createElement("canvas");
      c2.width = w * sc;
      c2.height = h * sc;
      c2.getContext("2d").drawImage(c, 0, 0, c2.width, c2.height);
      setPreview(c2.toDataURL("image/jpeg", 0.62));
    } else {
      setPreview(c.toDataURL("image/jpeg", 0.62));
    }
  };

  const acceptPhoto = () => {
    if (preview) {
      setCaptured((p) => [...p, preview]);
      setPreview(null);
    }
  };

  const retakePhoto = () => setPreview(null);

  const handleFileSelect = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const d = await compressPhoto(f);
    setCaptured((p) => [...p, d]);
    e.target.value = "";
  };

  const done = () => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    onCapture(captured);
  };

  const cancel = () => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 400, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "rgba(0,0,0,.8)", zIndex: 1 }}>
        <button onClick={cancel} style={{ background: "none", border: "none", color: "#fff", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>✕ Cancelar</button>
        <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>{captured.length} foto(s)</span>
        <button onClick={toggleFlash} style={{ background: flashOn ? "#fbbf24" : "rgba(255,255,255,.2)", border: "none", color: flashOn ? "#000" : "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>⚡ {flashOn ? "ON" : "OFF"}</button>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
        {preview ? (
          <img src={preview} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        ) : (
          <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        {!preview && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ width: "80%", maxWidth: 300, aspectRatio: "4/3", border: "2px solid rgba(255,255,255,.3)", borderRadius: 12 }} />
          </div>
        )}
      </div>

      {captured.length > 0 && (
        <div style={{ display: "flex", gap: 6, padding: "8px 16px", background: "rgba(0,0,0,.8)", overflowX: "auto" }}>
          {captured.map((ph, i) => (
            <div key={i} style={{ position: "relative", flexShrink: 0 }}>
              <img src={ph} alt="" style={{ width: 48, height: 48, borderRadius: 6, objectFit: "cover", border: "2px solid #fff" }} />
              <button onClick={() => setCaptured((p) => p.filter((_, j) => j !== i))} style={{ position: "absolute", top: -4, right: -4, background: "#dc2626", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", padding: "16px", background: "rgba(0,0,0,.9)" }}>
        {preview ? (
          <>
            <button onClick={retakePhoto} style={{ background: "rgba(255,255,255,.2)", border: "none", color: "#fff", borderRadius: 12, padding: "12px 24px", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>↩ Refazer</button>
            <button onClick={acceptPhoto} style={{ background: "#16a34a", border: "none", color: "#fff", borderRadius: 12, padding: "12px 24px", fontSize: 14, cursor: "pointer", fontWeight: 700 }}>✓ Usar foto</button>
          </>
        ) : (
          <>
            <button onClick={() => fileInputRef.current?.click()} style={{ background: "rgba(255,255,255,.2)", border: "none", color: "#fff", borderRadius: "50%", width: 48, height: 48, fontSize: 20, cursor: "pointer" }}>🖼️</button>
            <button onClick={takePhoto} style={{ background: "#fff", border: "4px solid rgba(255,255,255,.3)", borderRadius: "50%", width: 72, height: 72, cursor: "pointer" }}>
              <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "#fff" }} />
            </button>
            <button onClick={flipCamera} style={{ background: "rgba(255,255,255,.2)", border: "none", color: "#fff", borderRadius: "50%", width: 48, height: 48, fontSize: 20, cursor: "pointer" }}>🔄</button>
          </>
        )}
      </div>

      {captured.length > 0 && !preview && (
        <button onClick={done} style={{ margin: "0 16px 16px", background: "#1e3a8a", color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          ✓ Concluir ({captured.length} foto{captured.length > 1 ? "s" : ""})
        </button>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileSelect} />
    </div>
  );
}

