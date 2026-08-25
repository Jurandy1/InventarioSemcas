import React, { useEffect, useState } from "react";
import MiniSearch from "minisearch";
import { Badge } from "../components/Badge.jsx";
import { TInput } from "../components/FormFields.jsx";
import { ESTADOS, EC } from "../constants/inventory.js";
import { CATEGORY_TREE, getCategoryGroup, getSubcategoryLabel } from "../constants/categories.js";
import { SmartImg } from "../components/SmartImg.jsx";
import { RelatorioFotosModal } from "../components/modals/RelatorioFotosModal.jsx";
import { getListLimits } from "../utils/mobilePerf.js";

function getItemCode(item) {
  return item?.patrimonioLabel || item?.id || "—";
}

function getDisplayDesc(item, foundEntry) {
  return foundEntry?.descricaoEdit || item.descricao || item.especie || "—";
}

export function ItensPage({ todosItens, unidades, foundMap, foundSet, locais = [], saveAtiva, formRef, bumpFt, setModal, isMob, inp, cd, bs, bp, showT, onViewImage }) {
  const listLimits = React.useMemo(() => getListLimits(isMob), [isMob]);
  const [localCat, setLocalCat] = useState("Todas");
  const [localSub, setLocalSub] = useState(null);
  const [localEst, setLocalEst] = useState("Todos");
  const [localUnit, setLocalUnit] = useState("Todas");
  const [localStat, setLocalStat] = useState("Todos");
  const [localQ, setLocalQ] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(() => getListLimits(isMob).perPage);

  useEffect(() => {
    setPerPage(getListLimits(isMob).perPage);
    setPage(1);
  }, [isMob]);
  const defQ = React.useDeferredValue(localQ);

  const resetPage = () => setPage(1);

  const [hideIncorporados, setHideIncorporados] = useState(() => {
    try { return localStorage.getItem("inv-hide-incorporados") === "1"; } catch { return false; }
  });
  const [showRelatorioFotos, setShowRelatorioFotos] = useState(false);
  const [relatorioInitialView, setRelatorioInitialView] = useState("preview");

  const openRelatorio = (view = "preview") => {
    setRelatorioInitialView(view);
    setShowRelatorioFotos(true);
  };

  const toggleHideInc = (next) => {
    setHideIncorporados(next);
    try { localStorage.setItem("inv-hide-incorporados", next ? "1" : "0"); } catch {}
  };

  const soEncontrados = localStat === "Inventariados";
  const toggleSoEncontrados = (next) => {
    setLocalStat(next ? "Inventariados" : "Todos");
    resetPage();
  };

  const catCounts = React.useMemo(() => {
    const m = { Todas: todosItens.length };
    for (const i of todosItens) {
      const g = getCategoryGroup(i.especie);
      m[g] = (m[g] || 0) + 1;
    }
    return m;
  }, [todosItens]);

  const subCounts = React.useMemo(() => {
    if (localCat === "Todas") return {};
    const m = {};
    for (const i of todosItens) {
      if (getCategoryGroup(i.especie) !== localCat) continue;
      const s = getSubcategoryLabel(i.especie, localCat) || "Outros";
      m[s] = (m[s] || 0) + 1;
    }
    return m;
  }, [todosItens, localCat]);

  const activeCatDef = React.useMemo(() => CATEGORY_TREE.find((c) => c.name === localCat) || null, [localCat]);

  const miniSearch = React.useMemo(() => {
    const ms = new MiniSearch({
      fields: ["id", "descricao", "especie", "marca", "fornecedor", "nf", "descricaoEdit", "permutaDesc", "permutaMarca"],
      storeFields: ["id"],
      searchOptions: {
        prefix: true,
        fuzzy: 0.2,
      },
      tokenize: (str) => str.toLowerCase().split(/[\s,]+/),
    });
    const docs = todosItens.map((i) => ({
      ...i,
      descricaoEdit: foundMap[i.id]?.descricaoEdit || "",
      permutaDesc: foundMap[i.id]?.permutaDesc || "",
      permutaMarca: foundMap[i.id]?.permutaMarca || "",
    }));
    ms.addAll(docs);
    return ms;
  }, [todosItens, foundMap]);

  const searchResults = React.useMemo(() => {
    const q = defQ.toLowerCase().trim();
    if (!q) return null;
    return new Set(miniSearch.search(q).map((r) => r.id));
  }, [miniSearch, defQ]);

  const filtered = React.useMemo(() => {
    return todosItens.filter((i) => {
      if (hideIncorporados && (i.tipoEntrada || "Próprio") === "Incorporado") return false;
      const esp = i.especie || "";
      if (localCat !== "Todas") {
        if (getCategoryGroup(esp) !== localCat) return false;
        if (localSub !== null) {
          if (getSubcategoryLabel(esp, localCat) !== localSub) return false;
        }
      }
      if (localEst !== "Todos" && foundMap[i.id]?.estado !== localEst) return false;
      if (localUnit !== "Todas" && i.unidadeId !== localUnit) return false;
      if (localStat === "Inventariados" && !foundSet.has(i.id)) return false;
      if (localStat === "Pendentes" && foundSet.has(i.id)) return false;
      if (searchResults && !searchResults.has(i.id)) return false;
      return true;
    });
  }, [todosItens, foundMap, foundSet, localCat, localSub, localEst, localUnit, localStat, searchResults, hideIncorporados]);

  const selectCat = (name) => {
    setLocalCat(name);
    setLocalSub(null);
    resetPage();
  };
  const selectSub = (sub) => {
    setLocalSub(sub);
    resetPage();
  };

  // Reset página quando filtros mudam
  React.useEffect(() => { resetPage(); }, [localEst, localUnit, localStat, defQ]);

  const SidebarCatBtn = ({ cat }) => {
    const active = localCat === cat.name;
    return (
      <button
        onClick={() => selectCat(cat.name)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          background: active ? "#1351B4" : "transparent",
          color: active ? "#fff" : "#374151",
          border: "none",
          borderRadius: 8,
          padding: "8px 10px",
          fontSize: 13,
          fontWeight: active ? 700 : 500,
          cursor: "pointer",
          marginBottom: 2,
          textAlign: "left",
        }}
      >
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.name}</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
            background: active ? "rgba(255,255,255,.2)" : "#e2e8f0",
            color: active ? "#fff" : "#64748b",
            borderRadius: 99,
            padding: "1px 6px",
          }}
        >
          {catCounts[cat.name] || 0}
        </span>
      </button>
    );
  };

  const SidebarSubBtn = ({ sub }) => {
    const active = localSub === sub;
    const count = subCounts[sub] || 0;
    return (
      <button
        onClick={() => selectSub(active ? null : sub)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          background: active ? "#dbeafe" : "transparent",
          color: active ? "#1d4ed8" : "#6b7280",
          border: `1px solid ${active ? "#93c5fd" : "transparent"}`,
          borderRadius: 7,
          padding: "6px 8px 6px 28px",
          fontSize: 12,
          fontWeight: active ? 700 : 400,
          cursor: "pointer",
          marginBottom: 1,
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 10, opacity: 0.5 }}>└</span>
        <span style={{ flex: 1 }}>{sub}</span>
        <span style={{ fontSize: 10, fontWeight: 700, flexShrink: 0, color: active ? "#1d4ed8" : "#94a3b8" }}>{count}</span>
      </button>
    );
  };

  const localNomeById = React.useMemo(() => {
    const m = new Map();
    for (const l of locais || []) {
      const id = l?.id || l?._id;
      if (id) m.set(id, l.nome || id);
    }
    return m;
  }, [locais]);

  const resolveLocalNome = (localId) => {
    if (!localId || localId === "sem-local") return "Sem local";
    return localNomeById.get(localId) || localId;
  };

  const ItemCard = ({ item }) => {
    const f = foundMap[item.id];
    const foto = f?.fotoUrls?.[0];
    const isF = !!f;
    const catDef = CATEGORY_TREE.find((c) => getCategoryGroup(item.especie) === c.name) || CATEGORY_TREE[CATEGORY_TREE.length - 1];
    const displayDesc = getDisplayDesc(item, f);
    const isPermuta = f?.situacao === "Permuta";
    const unidadeLabel = ((f?.unidadeNome || item.unidadeNome || "").replace(/^\d+[\d.]*\s*-\s*/, "") || "—").slice(0, 40);
    const localLabel = isF ? resolveLocalNome(f?.localId) : "";

    return (
      <div
        onClick={() => {
          const u = unidades.find((x) => x.id === item.unidadeId);
          if (u) saveAtiva(u);
          formRef.current = {
            detItem: item,
            detEstado: f?.estado || "Bom",
            detSituacao: f?.situacao || "Em uso",
            detLocal: f?.localId || "",
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
          };
          bumpFt();
          setModal("detalhe");
        }}
        style={{
          ...cd,
          cursor: "pointer",
          padding: 0,
          overflow: "hidden",
          border: `1.5px solid ${isPermuta ? "#fcd34d" : isF ? "#bbf7d0" : "#e2e8f0"}`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            width: "100%",
            height: 130,
            flexShrink: 0,
            position: "relative",
            background: foto ? "#000" : isF ? "#f0fdf4" : "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {foto ? (
            <SmartImg
              src={foto}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "zoom-in" }}
              onClick={(e) => {
                e.stopPropagation();
                onViewImage?.(foto);
              }}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: isPermuta ? "#92400e" : isF ? "#16a34a" : "#94a3b8", letterSpacing: ".05em" }}>
                {isPermuta ? "PERMUTA" : isF ? "SEM FOTO" : "PENDENTE"}
              </span>
            </div>
          )}
          <div style={{ position: "absolute", top: 5, right: 5, background: isPermuta ? "#f59e0b" : isF ? "#16a34a" : "#f59e0b", borderRadius: 99, width: 9, height: 9, boxShadow: "0 0 0 2px #fff" }} />
          {(f?.fotoUrls?.length || 0) > 1 && (
            <div style={{ position: "absolute", bottom: 5, right: 5, background: "rgba(0,0,0,.55)", color: "#fff", borderRadius: 99, fontSize: 9, fontWeight: 700, padding: "2px 6px" }}>
              {f.fotoUrls.length} fotos
            </div>
          )}
        </div>

        <div style={{ padding: "9px 10px 10px", flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 800,
              color: "#0f172a",
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {displayDesc}
          </p>
          {isPermuta && f?.permutaDesc && (
            <p style={{ margin: 0, fontSize: 9, color: "#92400e", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Permuta real: {f.permutaDesc}
            </p>
          )}
          <p style={{ margin: 0, fontSize: 9, color: "#64748b", fontWeight: 600 }}>Nº {getItemCode(item)}</p>
          <p style={{ margin: "1px 0 0", fontSize: 9, color: "#475569", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Unidade: {unidadeLabel}
          </p>
          {isF && (
            <p style={{ margin: "1px 0 0", fontSize: 9, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Local: {localLabel}
            </p>
          )}
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 3 }}>
            {isF ? (
              <>
                <Badge label={f.estado} c={EC[f.estado]} />
                {(f.usuario || f.user) && <Badge label={`${f.usuario || f.user}${f.hora ? ` ${f.hora}` : ""}`} c={{ bg: "#e0e7ff", tx: "#3730a3" }} />}
              </>
            ) : (
              <Badge label="Pendente" c={{ bg: "#fff7ed", tx: "#c2410c" }} />
            )}
            {item.tipoEntrada && item.tipoEntrada !== "Próprio" && (
              <Badge
                label={item.tipoEntrada}
                c={item.tipoEntrada === "Doação" ? { bg: "#fef3c7", tx: "#92400e" } : { bg: "#d1fae5", tx: "#065f46" }}
              />
            )}
            {(item?.isManual || f?.isManual || String(item?.id || "").startsWith("MAN_")) && <Badge label="Inserido Manualmente" c={{ bg: "#fef08a", tx: "#854d0e" }} />}
            {item?.unidadeId && f?.unidadeId && item.unidadeId !== f.unidadeId && <Badge label="De Outra Unidade" c={{ bg: "#fecaca", tx: "#991b1b" }} />}
          </div>
          <p style={{ margin: "3px 0 0", fontSize: 10, color: "#059669", fontWeight: 700 }}>R$ {(item.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
      </div>
    );
  };

  const unitOptions = React.useMemo(
    () =>
      unidades.map((u) => ({
        id: u.id,
        label: u.nome.replace(/^\d+[\d.]*\s*-\s*/, "").slice(0, 52),
      })),
    [unidades]
  );

  const MobileChips = ({ items, selected, onSelect, size = 12 }) => (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 8 }}>
      {items.map((item) => {
        const label = item.name || item;
        const icon = item.icon || "";
        const active = selected === label;
        return (
          <button
            key={label}
            onClick={() => onSelect(active ? null : label)}
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: active ? "#1351B4" : "#f1f5f9",
              color: active ? "#fff" : "#374151",
              border: `1.5px solid ${active ? "#1351B4" : "#e2e8f0"}`,
              borderRadius: 99,
              padding: "5px 10px",
              fontSize: size,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {icon && <span>{icon}</span>}
            {label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      {!isMob && (
        <div
          style={{
            width: 200,
            flexShrink: 0,
            background: "#fff",
            borderRadius: 12,
            padding: "12px 8px",
            boxShadow: "0 1px 3px rgba(0,0,0,.06)",
            position: "sticky",
            top: 80,
            maxHeight: "calc(100vh - 100px)",
            overflowY: "auto",
          }}
        >
          <button
            onClick={() => selectCat("Todas")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              background: localCat === "Todas" ? "#1351B4" : "transparent",
              color: localCat === "Todas" ? "#fff" : "#374151",
              border: "none",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 13,
              fontWeight: localCat === "Todas" ? 700 : 500,
              cursor: "pointer",
              marginBottom: 6,
              textAlign: "left",
            }}
          >
            <span style={{ flex: 1 }}>Todos</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                background: localCat === "Todas" ? "rgba(255,255,255,.2)" : "#e2e8f0",
                color: localCat === "Todas" ? "#fff" : "#64748b",
                borderRadius: 99,
                padding: "1px 6px",
              }}
            >
              {catCounts.Todas || 0}
            </span>
          </button>

          {CATEGORY_TREE.map((cat) => (
            <React.Fragment key={cat.name}>
              <SidebarCatBtn cat={cat} />
              {localCat === cat.name && cat.subs && (
                <div style={{ marginBottom: 4 }}>
                  {cat.subs
                    .filter((s) => subCounts[s.label] > 0)
                    .map((s) => (
                      <SidebarSubBtn key={s.label} sub={s.label} />
                    ))}
                </div>
              )}
            </React.Fragment>
          ))}

          <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "10px 0 8px" }} />
          <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", padding: "0 4px" }}>Status</p>
          {[
            { key: "Todos", label: "Todos" },
            { key: "Inventariados", label: "Só encontrados" },
            { key: "Pendentes", label: "Pendentes" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => {
                setLocalStat(s.key);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: localStat === s.key ? "#1351B4" : "transparent",
                color: localStat === s.key ? "#fff" : "#374151",
                border: "none",
                borderRadius: 8,
                padding: "7px 10px",
                fontSize: 12,
                fontWeight: localStat === s.key ? 700 : 500,
                cursor: "pointer",
                marginBottom: 2,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Itens</h2>
              {localCat !== "Todas" && (
                <span style={{ fontSize: 13, color: "#1351B4", fontWeight: 700 }}>
                  {localCat}
                  {localSub && <span style={{ color: "#64748b", fontWeight: 500 }}> › {localSub}</span>}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => openRelatorio("preview")}
                style={{
                  ...(bs || { background: "#fff", color: "#1351B4", border: "1.5px solid #1351B4", borderRadius: 9, fontWeight: 700, cursor: "pointer" }),
                  fontSize: 12,
                  padding: "8px 14px",
                  whiteSpace: "nowrap",
                  borderColor: "#1351B4",
                  color: "#1351B4",
                }}
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => openRelatorio("categorias")}
                style={{
                  ...(bp || { background: "#1351B4", color: "#fff", border: "none", borderRadius: 9, padding: "8px 14px", fontWeight: 700, cursor: "pointer" }),
                  fontSize: 12,
                  padding: "8px 14px",
                  whiteSpace: "nowrap",
                }}
              >
                Relatório PDF
              </button>
            </div>
          </div>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>{filtered.length.toLocaleString("pt-BR")} item(s)</p>
        </div>

        {isMob && (
          <>
            <MobileChips items={[{ name: "Todas" }, ...CATEGORY_TREE]} selected={localCat} onSelect={(name) => selectCat(name || "Todas")} />
            {localCat !== "Todas" && activeCatDef && (
              <MobileChips
                items={activeCatDef.subs.filter((s) => subCounts[s.label] > 0).map((s) => s.label)}
                selected={localSub}
                onSelect={(sub) => selectSub(sub)}
                size={11}
              />
            )}
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {[
                { key: "Todos", label: "Todos" },
                { key: "Inventariados", label: "Só encontrados" },
                { key: "Pendentes", label: "Pendentes" },
              ].map((s) => (
                <button
                  key={s.key}
                  onClick={() => {
                    setLocalStat(s.key);
                    resetPage();
                  }}
                  style={{
                    flex: 1,
                    background: localStat === s.key ? "#1351B4" : "#f1f5f9",
                    color: localStat === s.key ? "#fff" : "#374151",
                    border: "none",
                    borderRadius: 8,
                    padding: "7px 4px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "2fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
          <TInput
            initial={localQ}
            onVal={(v) => {
              setLocalQ(v);
            }}
            placeholder="Buscar descrição, Nº, marca, NF..."
            style={inp}
          />
          <select
            value={localEst}
            onChange={(e) => {
              setLocalEst(e.target.value);
            }}
            style={inp}
          >
            <option value="Todos">Estado: Todos</option>
            {ESTADOS.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
          <select
            value={localUnit}
            onChange={(e) => {
              setLocalUnit(e.target.value);
            }}
            style={inp}
          >
            <option value="Todas">Unidade: Todas</option>
            {unitOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={soEncontrados}
              onChange={(e) => toggleSoEncontrados(e.target.checked)}
            />
            Só mostrar o que foi encontrado no inventário
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={!!hideIncorporados}
              onChange={(e) => toggleHideInc(e.target.checked)}
            />
            Ocultar itens Incorporados
          </label>
        </div>

        {showRelatorioFotos && (
          <RelatorioFotosModal
            isMob={isMob}
            onClose={() => setShowRelatorioFotos(false)}
            todosItens={todosItens}
            foundMap={foundMap}
            foundSet={foundSet}
            locais={locais}
            initialCategorias={localCat !== "Todas" ? [localCat] : []}
            initialView={relatorioInitialView}
            bp={bp || { background: "#1351B4", color: "#fff", border: "none", borderRadius: 9, padding: "11px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            bs={bs}
            showT={showT}
            onViewImage={onViewImage}
          />
        )}

        {filtered.length === 0 ? (
          <div style={{ ...cd, textAlign: "center", padding: 48 }}>
            <p style={{ color: "#94a3b8", margin: 0 }}>Nenhum item com esses filtros.</p>
            <button
              onClick={() => {
                selectCat("Todas");
                setLocalStat("Todos");
                setLocalEst("Todos");
              }}
              style={{ ...bs, marginTop: 12, fontSize: 12 }}
            >
              Limpar filtros
            </button>
          </div>
        ) : (() => {
          const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
          const safePage = Math.min(page, totalPages);
          const pageItems = filtered.slice((safePage - 1) * perPage, safePage * perPage);

          // Gera botões de página: sempre mostra primeiros, últimos e vizinhos da página atual
          const buildPageButtons = () => {
            if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
            const pages = new Set([1, 2, totalPages - 1, totalPages, safePage - 1, safePage, safePage + 1].filter(p => p >= 1 && p <= totalPages));
            const sorted = [...pages].sort((a, b) => a - b);
            const result = [];
            for (let i = 0; i < sorted.length; i++) {
              if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("...");
              result.push(sorted[i]);
            }
            return result;
          };

          const btnStyle = (active) => ({
            minWidth: 32,
            height: 32,
            borderRadius: 8,
            border: active ? "2px solid #1351B4" : "1.5px solid #e2e8f0",
            background: active ? "#1351B4" : "#fff",
            color: active ? "#fff" : "#374151",
            fontWeight: active ? 800 : 600,
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 6px",
            transition: "all .15s",
          });

          return (
            <>
              {/* Grid de cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMob ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(185px, 1fr))",
                  gap: 10,
                }}
              >
                {pageItems.map((item) => (
                  <ItemCard key={`${item.unidadeId}_${item.id}`} item={item} />
                ))}
              </div>

              {/* Controles de paginação */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  marginTop: 20,
                  flexWrap: "wrap",
                }}
              >
                {/* Botão anterior */}
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  style={{ ...btnStyle(false), opacity: safePage === 1 ? 0.4 : 1 }}
                  title="Página anterior"
                >
                  ‹
                </button>

                {/* Números de página */}
                {buildPageButtons().map((p, i) =>
                  p === "..." ? (
                    <span key={`ellipsis-${i}`} style={{ padding: "0 4px", color: "#94a3b8", fontSize: 13 }}>…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      style={btnStyle(p === safePage)}
                    >
                      {p}
                    </button>
                  )
                )}

                {/* Botão próximo */}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  style={{ ...btnStyle(false), opacity: safePage === totalPages ? 0.4 : 1 }}
                  title="Próxima página"
                >
                  ›
                </button>

                {/* Seletor de itens por página */}
                <select
                  value={perPage}
                  onChange={(e) => { setPerPage(Number(e.target.value)); resetPage(); }}
                  style={{
                    marginLeft: 12,
                    height: 32,
                    borderRadius: 8,
                    border: "1.5px solid #e2e8f0",
                    background: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#374151",
                    padding: "0 8px",
                    cursor: "pointer",
                  }}
                >
                  {[12, 24, 48, 96].map((n) => (
                    <option key={n} value={n}>{n} por página</option>
                  ))}
                </select>

                {/* Indicador de página */}
                <span style={{ fontSize: 12, color: "#64748b", marginLeft: 4 }}>
                  Página {safePage} de {totalPages}
                </span>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
