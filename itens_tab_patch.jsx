// ============================================================
// PATCH v2.2 — Aba "Itens" completa
// Arquivo: src/app/App.jsx
// ============================================================
//
// PASSO 1 — Adicionar logo após as declarações de estado
// existentes (após a linha: const [ft, setFt] = useState(0))
//
//   const [itensFilterUnit, setItensFilterUnit] = useState("Todas");
//   const [itensFilterStatus, setItensFilterStatus] = useState("Todos");
//
// PASSO 2 — Adicionar a função getCategoryGroup ANTES do return()
// principal do componente App (pode ser logo após o objeto origemMeta)
//
// PASSO 3 — Substituir COMPLETAMENTE o bloco:
//   {tab === "itens" && (  ...  )}
// pelo código abaixo.
// ============================================================

// ── PASSO 2 ── Colar antes do return() ─────────────────────

const CATEGORY_DEFS = [
  { name: "Cadeiras",     icon: "🪑", re: /CADEIRA|POLTRONA|LONGARINA|ASSENTO/ },
  { name: "Mesas",        icon: "🪞", re: /^MESA|BANCADA|BALCÃO/ },
  { name: "Armários",     icon: "🗄️", re: /ARMÁRI|ARMARIO|ARQUIVO|ESTANTE|GAVETEIRO|RACK|PRATELEIRA|ROUPEIRO/ },
  { name: "Informática",  icon: "💻", re: /NOTEBOOK|COMPUTADOR|MICROCOMPUTADOR|CPU|LAPTOP|TABLET|DESKTOP|SCANNER|IMPRESSORA|MULTIFUNCIONAL|MONITOR|FRAGMENTADORA/ },
  { name: "TV / AV",      icon: "📺", re: /TELEVISOR|TV |PROJETOR|TELÃO|DISPLAY|TELA/ },
  { name: "Climatização", icon: "❄️", re: /AR CONDICIONADO|VENTILADOR|CLIMATIZADOR|EXAUSTOR|SPLIT|PURIFICADOR/ },
  { name: "Rede / TI",    icon: "🔌", re: /CÂMERA|CAMERA|ROTEADOR|SWITCH|NOBREAK|ESTABILIZADOR|SERVIDOR|HUB|MICROFONE|CAIXA AMPLIF/ },
  { name: "Cozinha",      icon: "🍳", re: /LIQUIDIFICADOR|GELADEIRA|FOGÃO|MICROONDAS|CAFETEIRA|BEBEDOURO|FREEZER|FORNO|FILTRO|REFRIGERADOR|FOGAO/ },
  { name: "Saúde",        icon: "🏥", re: /CAMA |MACA|COLCHÃO|BERÇO|BERCE/ },
  { name: "Outros",       icon: "📦", re: null },
];

function getCategoryGroup(especie) {
  const e = String(especie || "").toUpperCase();
  for (const c of CATEGORY_DEFS) {
    if (c.re && c.re.test(e)) return c.name;
  }
  return "Outros";
}

// ── PASSO 3 ── Substituir o bloco {tab === "itens" && ...} ──

{tab === "itens" && (
  <div>
    {(() => {
      /* ── estado local ── */
      const [localCat,  setLocalCat]    = React.useState("Todas");
      const [localEst,  setLocalEst]    = React.useState("Todos");
      const [localOrig, setLocalOrig]   = React.useState("Todas");
      const [localUnit, setLocalUnit]   = React.useState("Todas");
      const [localStat, setLocalStat]   = React.useState("Todos");
      const [localQ,    setLocalQ]      = React.useState("");
      const [localPage, setLocalPage]   = React.useState(1);
      const IPER = 24;

      /* ── base de itens: todos, com unidade ── */
      const base = todosItens;

      /* ── contagem por categoria ── */
      const catCounts = React.useMemo(() => {
        const m = { Todas: base.length };
        for (const i of base) {
          const g = getCategoryGroup(i.especie);
          m[g] = (m[g] || 0) + 1;
        }
        return m;
      }, [base.length]);

      /* ── filtro ── */
      const filtered = React.useMemo(() => {
        const q = localQ.toLowerCase().trim();
        return base.filter((i) => {
          if (localCat !== "Todas" && getCategoryGroup(i.especie) !== localCat) return false;
          if (localEst !== "Todos" && foundMap[i.id]?.estado !== localEst) return false;
          if (localOrig !== "Todas") {
            const orig = foundMap[i.id]?.origem || i.tipoEntrada || "Próprio";
            if (orig !== localOrig) return false;
          }
          if (localUnit !== "Todas" && i.unidadeId !== localUnit) return false;
          if (localStat === "Inventariados" && !foundSet.has(i.id)) return false;
          if (localStat === "Pendentes" && foundSet.has(i.id)) return false;
          if (q && !(
            i.id.toLowerCase().includes(q) ||
            (i.descricao || "").toLowerCase().includes(q) ||
            (i.especie   || "").toLowerCase().includes(q) ||
            (i.marca     || "").toLowerCase().includes(q) ||
            (i.fornecedor|| "").toLowerCase().includes(q) ||
            (i.nf        || "").toLowerCase().includes(q)
          )) return false;
          return true;
        });
      }, [base, localCat, localEst, localOrig, localUnit, localStat, localQ]);

      const totalPages = Math.max(1, Math.ceil(filtered.length / IPER));
      const curPage    = Math.min(localPage, totalPages);
      const paged      = filtered.slice((curPage - 1) * IPER, curPage * IPER);

      const reset = () => setLocalPage(1);

      /* ── sidebar de categorias ── */
      const CatBtn = ({ name, icon, count }) => {
        const active = localCat === name;
        return (
          <button
            onClick={() => { setLocalCat(name); reset(); }}
            style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%",
              background: active ? "#1e3a8a" : "transparent",
              color: active ? "#fff" : "#374151",
              border: "none", borderRadius: 8, padding: "8px 10px",
              fontSize: 13, fontWeight: active ? 700 : 500, cursor: "pointer",
              marginBottom: 2, textAlign: "left", transition: "background .15s",
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
            <span style={{ flex: 1 }}>{name}</span>
            <span style={{
              fontSize: 11, fontWeight: 700,
              background: active ? "rgba(255,255,255,.2)" : "#e2e8f0",
              color: active ? "#fff" : "#64748b",
              borderRadius: 99, padding: "1px 6px", minWidth: 26, textAlign: "center",
            }}>
              {count || 0}
            </span>
          </button>
        );
      };

      /* ── card de item ── */
      const ItemCard = ({ item }) => {
        const f    = foundMap[item.id];
        const foto = f?.fotoUrls?.[0];
        const isF  = !!f;
        const catDef = CATEGORY_DEFS.find(c => getCategoryGroup(item.especie) === c.name) || CATEGORY_DEFS[CATEGORY_DEFS.length - 1];

        return (
          <div
            onClick={() => {
              const u = unidades.find(x => x.id === item.unidadeId);
              if (u) saveAtiva(u);
              form.current = {
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
              };
              setFt(t => t + 1);
              setModal("detalhe");
            }}
            style={{
              ...cd, cursor: "pointer", padding: 0, overflow: "hidden",
              border: `1.5px solid ${isF ? "#bbf7d0" : "#e2e8f0"}`,
              transition: "box-shadow .15s, transform .15s",
              display: "flex", flexDirection: "column",
            }}
          >
            {/* ── foto ou placeholder ── */}
            <div style={{
              width: "100%", height: 140, flexShrink: 0, position: "relative",
              background: foto ? "#000" : (isF ? "#f0fdf4" : "#f8fafc"),
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
            }}>
              {foto ? (
                <img
                  src={foto}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 36, opacity: isF ? 0.6 : 0.25 }}>{catDef.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: isF ? "#16a34a" : "#94a3b8", letterSpacing: ".05em" }}>
                    {isF ? "✅ SEM FOTO" : "📷 PENDENTE"}
                  </span>
                </div>
              )}
              {/* badge de status sobreposto */}
              <div style={{
                position: "absolute", top: 6, right: 6,
                background: isF ? "#16a34a" : "#f59e0b",
                borderRadius: 99, width: 10, height: 10, boxShadow: "0 0 0 2px #fff",
              }} />
              {/* total de fotos */}
              {(f?.fotoUrls?.length || 0) > 1 && (
                <div style={{
                  position: "absolute", bottom: 6, right: 6,
                  background: "rgba(0,0,0,.55)", color: "#fff",
                  borderRadius: 99, fontSize: 10, fontWeight: 700, padding: "2px 7px",
                }}>
                  📷 {f.fotoUrls.length}
                </div>
              )}
            </div>

            {/* ── corpo ── */}
            <div style={{ padding: "10px 12px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#0f172a", lineHeight: 1.3,
                overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box",
                WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                {item.descricao || item.especie || "—"}
              </p>
              <p style={{ margin: 0, fontSize: 10, color: "#64748b", fontWeight: 600 }}>
                Nº {item.id}
              </p>
              <p style={{ margin: "1px 0 0", fontSize: 10, color: "#94a3b8",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.unidadeNome?.replace(/^\d+[\d.]*\s*-\s*/, "").slice(0, 38)}
              </p>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                {isF ? (
                  <>
                    <Badge label={f.estado} c={EC[f.estado]} />
                    {item.tipoEntrada !== "Próprio" && (
                      <Badge label={item.tipoEntrada}
                        c={item.tipoEntrada === "Doação"
                          ? { bg: "#fef3c7", tx: "#92400e" }
                          : { bg: "#d1fae5", tx: "#065f46" }} />
                    )}
                  </>
                ) : (
                  <Badge label="Pendente" c={{ bg: "#fff7ed", tx: "#c2410c" }} />
                )}
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#059669", fontWeight: 700 }}>
                R$ {(item.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        );
      };

      /* ── unidades para o filtro ── */
      const unitOptions = React.useMemo(() =>
        unidades.map(u => ({
          id: u.id,
          label: u.nome.replace(/^\d+[\d.]*\s*-\s*/, "").slice(0, 50),
        })),
        [unidades.length]
      );

      /* ── layout ── */
      return (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          {/* ── SIDEBAR (desktop) ── */}
          {!isMob && (
            <div style={{
              width: 196, flexShrink: 0, background: "#fff",
              borderRadius: 12, padding: 14,
              boxShadow: "0 1px 3px rgba(0,0,0,.06)",
              position: "sticky", top: 80, maxHeight: "calc(100vh - 100px)", overflowY: "auto",
            }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em" }}>
                Categoria
              </p>
              <CatBtn name="Todas" icon="🗂️" count={catCounts.Todas} />
              {CATEGORY_DEFS.map(c => (
                <CatBtn key={c.name} name={c.name} icon={c.icon} count={catCounts[c.name] || 0} />
              ))}

              <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "12px 0 10px" }} />
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em" }}>
                Status
              </p>
              {["Todos", "Inventariados", "Pendentes"].map(s => (
                <button key={s} onClick={() => { setLocalStat(s); reset(); }}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    background: localStat === s ? "#1e3a8a" : "transparent",
                    color: localStat === s ? "#fff" : "#374151",
                    border: "none", borderRadius: 8, padding: "7px 10px",
                    fontSize: 12, fontWeight: localStat === s ? 700 : 500, cursor: "pointer", marginBottom: 2,
                  }}>
                  {s === "Todos" ? "📋 Todos" : s === "Inventariados" ? "✅ Inventariados" : "⏳ Pendentes"}
                </button>
              ))}
            </div>
          )}

          {/* ── CONTEÚDO PRINCIPAL ── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🪑 Itens</h2>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
                  {filtered.length.toLocaleString("pt-BR")} item(s)
                  {localCat !== "Todas" ? ` · ${localCat}` : ""}
                  {localStat !== "Todos" ? ` · ${localStat}` : ""}
                </p>
              </div>
              {/* chips de categoria mobile */}
              {isMob && (
                <div style={{ width: "100%", display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                  {[{ name: "Todas", icon: "🗂️" }, ...CATEGORY_DEFS].map(c => (
                    <button
                      key={c.name}
                      onClick={() => { setLocalCat(c.name); reset(); }}
                      style={{
                        flexShrink: 0, display: "flex", alignItems: "center", gap: 4,
                        background: localCat === c.name ? "#1e3a8a" : "#f1f5f9",
                        color: localCat === c.name ? "#fff" : "#374151",
                        border: "none", borderRadius: 99, padding: "5px 10px",
                        fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                      }}>
                      <span>{c.icon}</span> {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── barra de filtros ── */}
            <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "2fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
              <TInput
                initial=""
                onVal={(v) => { setLocalQ(v); reset(); }}
                placeholder="🔍 Buscar descrição, Nº, marca, NF..."
                style={inp}
              />
              <select value={localEst} onChange={e => { setLocalEst(e.target.value); reset(); }} style={inp}>
                <option value="Todos">Estado: Todos</option>
                {ESTADOS.map(e => <option key={e}>{e}</option>)}
              </select>
              <select value={localUnit} onChange={e => { setLocalUnit(e.target.value); reset(); }} style={inp}>
                <option value="Todas">Unidade: Todas</option>
                {unitOptions.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </div>

            {/* ── status mobile ── */}
            {isMob && (
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {["Todos", "Inventariados", "Pendentes"].map(s => (
                  <button key={s} onClick={() => { setLocalStat(s); reset(); }}
                    style={{
                      flex: 1, background: localStat === s ? "#1e3a8a" : "#f1f5f9",
                      color: localStat === s ? "#fff" : "#374151",
                      border: "none", borderRadius: 8, padding: "7px 4px",
                      fontSize: 11, fontWeight: 700, cursor: "pointer",
                    }}>
                    {s === "Todos" ? "Todos" : s === "Inventariados" ? "✅" : "⏳"}
                    {s !== "Todos" ? ` ${s}` : ""}
                  </button>
                ))}
              </div>
            )}

            {/* ── grid de itens ── */}
            {paged.length === 0 ? (
              <div style={{ ...cd, textAlign: "center", padding: 48 }}>
                <p style={{ fontSize: 40, margin: "0 0 8px" }}>🔍</p>
                <p style={{ color: "#94a3b8", margin: 0 }}>Nenhum item encontrado com esses filtros.</p>
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: isMob ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 10,
              }}>
                {paged.map(item => <ItemCard key={`${item.unidadeId}_${item.id}`} item={item} />)}
              </div>
            )}

            {/* ── paginação ── */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
                <button onClick={() => setLocalPage(1)} disabled={curPage === 1} style={{ ...bs, padding: "6px 10px", fontSize: 12 }}>«</button>
                <button onClick={() => setLocalPage(p => Math.max(1, p - 1))} disabled={curPage === 1} style={{ ...bs, padding: "6px 10px", fontSize: 12 }}>‹</button>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Pág {curPage}/{totalPages} · {filtered.length.toLocaleString("pt-BR")} itens
                </span>
                <button onClick={() => setLocalPage(p => Math.min(totalPages, p + 1))} disabled={curPage === totalPages} style={{ ...bs, padding: "6px 10px", fontSize: 12 }}>›</button>
                <button onClick={() => setLocalPage(totalPages)} disabled={curPage === totalPages} style={{ ...bs, padding: "6px 10px", fontSize: 12 }}>»</button>
              </div>
            )}
          </div>
        </div>
      );
    })()}
  </div>
)}
