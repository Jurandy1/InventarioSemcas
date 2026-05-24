import React, { useEffect, useMemo, useRef, useState } from "react";

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripDiacritics(s) {
  const str = String(s);
  if (typeof str.normalize === "function") {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  return str
    .replace(/[ÁÀÂÃÄ]/g, "A")
    .replace(/[áàâãä]/g, "a")
    .replace(/[ÉÈÊË]/g, "E")
    .replace(/[éèêë]/g, "e")
    .replace(/[ÍÌÎÏ]/g, "I")
    .replace(/[íìîï]/g, "i")
    .replace(/[ÓÒÔÕÖ]/g, "O")
    .replace(/[óòôõö]/g, "o")
    .replace(/[ÚÙÛÜ]/g, "U")
    .replace(/[úùûü]/g, "u")
    .replace(/[Ç]/g, "C")
    .replace(/[ç]/g, "c");
}

function safeLocaleCompare(a, b) {
  try {
    return String(a).localeCompare(String(b), "pt-BR");
  } catch {
    return String(a).localeCompare(String(b));
  }
}

function normalizeWithMap(str) {
  const map = [];
  let norm = "";
  for (let i = 0; i < String(str).length; i++) {
    const ch = String(str)[i];
    const decomp = stripDiacritics(ch);
    for (let j = 0; j < decomp.length; j++) {
      norm += decomp[j];
      map.push(i);
    }
  }
  return { norm, map };
}

export function TInput({ initial, onVal, suggestions = [], onSuggestionSelect, ...p }) {
  const [v, setV] = useState(initial || "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    setV(initial || "");
  }, [initial]);

  const filtered = useMemo(() => {
    const q = stripDiacritics(String(v)).toLowerCase().trim();
    if (!q) return [];
    const uniq = new Set();
    const out = [];
    for (const s of suggestions || []) {
      if (!s) continue;
      const raw = String(s).trim();
      if (!raw) continue;
      const key = stripDiacritics(raw).toLowerCase();
      if (!key.includes(q)) continue;
      if (uniq.has(key)) continue;
      uniq.add(key);
      out.push(raw);
    }
    out.sort(safeLocaleCompare);
    return out.slice(0, 8);
  }, [suggestions, v]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const renderSuggestion = (suggestion) => {
    const inputRaw = String(v || "");
    const inputNorm = stripDiacritics(inputRaw).toLowerCase().trim();
    const { norm: sugNorm, map } = normalizeWithMap(String(suggestion));
    const idxNorm = inputNorm ? sugNorm.toLowerCase().indexOf(inputNorm) : -1;

    if (idxNorm < 0) return <span>{suggestion}</span>;

    const start = map[idxNorm] ?? 0;
    const end = (map[idxNorm + inputNorm.length - 1] ?? start) + 1;
    const before = String(suggestion).slice(0, start);
    const hit = String(suggestion).slice(start, end);
    const after = String(suggestion).slice(end);

    const rx = new RegExp(escapeRegExp(inputRaw), "i");
    if (!rx.test(hit) && inputRaw.trim()) {
      return (
        <span>
          {before}
          <strong style={{ color: "#1d4ed8", fontWeight: 700 }}>{hit}</strong>
          {after}
        </span>
      );
    }

    return (
      <span>
        {before}
        <strong style={{ color: "#1d4ed8", fontWeight: 700 }}>{hit}</strong>
        {after}
      </span>
    );
  };

  const chooseSuggestion = (suggestion) => {
    setV(suggestion);
    onVal(suggestion);
    onSuggestionSelect?.(suggestion);
    setShowSuggestions(false);
  };

  return (
    <div style={{ position: "relative" }} ref={containerRef}>
      <input
        {...p}
        value={v}
        onChange={(e) => {
          const next = e.target.value;
          setV(next);
          onVal(next);
          setShowSuggestions(true);
        }}
        onFocus={() => {
          if (String(v).trim().length > 0) setShowSuggestions(true);
        }}
      />

      {showSuggestions && filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1.5px solid #d1d5db",
            borderTop: "none",
            borderRadius: "0 0 8px 8px",
            maxHeight: 200,
            overflowY: "auto",
            zIndex: 100,
            boxShadow: "0 4px 12px rgba(0,0,0,.1)",
          }}
        >
          {filtered.map((suggestion, i) => (
            <button
              key={`${suggestion}-${i}`}
              type="button"
              onClick={() => chooseSuggestion(suggestion)}
              onMouseDown={(e) => {
                e.preventDefault();
                chooseSuggestion(suggestion);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                chooseSuggestion(suggestion);
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                chooseSuggestion(suggestion);
              }}
              style={{
                width: "100%",
                padding: "10px 13px",
                textAlign: "left",
                border: "none",
                background: i % 2 === 0 ? "#f8fafc" : "#fff",
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
                transition: "background .15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#eff6ff")}
              onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "#f8fafc" : "#fff")}
            >
              {renderSuggestion(suggestion)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TArea({ initial, onVal, ...p }) {
  const [v, setV] = useState(initial || "");
  useEffect(() => {
    setV(initial || "");
  }, [initial]);
  return (
    <textarea
      {...p}
      value={v}
      onChange={(e) => {
        const next = e.target.value;
        setV(next);
        onVal(next);
      }}
    />
  );
}
