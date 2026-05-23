// ============================================================
// PATCH v2.3 — Aba "Itens" com categorias + SUBcategorias
// Arquivo: src/app/App.jsx
//
// PASSO 1 — Adicionar ANTES do return() do componente App
//           (logo após const origemMeta = { ... })
//
// PASSO 2 — Substituir COMPLETAMENTE o bloco:
//           {tab === "itens" && (  ...  )}
// ============================================================

// ══════════════════════════════════════════════════════════════
// PASSO 1 — Colar antes do return()
// ══════════════════════════════════════════════════════════════

const CATEGORY_TREE = [
  {
    name: "Cadeiras", icon: "🪑",
    re: /CADEIRA|POLTRONA|LONGARINA|ASSENTO/,
    subs: [
      { label: "Cadeira Giratória",    match: e => /GIRAT|SECRETÁRI/.test(e) },
      { label: "Cadeira Plástica",     match: e => /PLÁST|PLASTIC/.test(e) },
      { label: "Cadeira Presidente",   match: e => /PRESIDENT/.test(e) },
      { label: "Longarina",            match: e => /LONGARINA/.test(e) },
      { label: "Conjunto c/ Mesa",     match: e => /CONJUNTO/.test(e) },
      { label: "Cadeira de Rodas",     match: e => /RODAS/.test(e) },
      { label: "Cadeira Fixa / Geral", match: () => true },
    ],
  },
  {
    name: "Mesas", icon: "🪞",
    re: /^MESA|BANCADA|BALCÃO/,
    subs: [
      { label: "Mesa de Trabalho",    match: e => /TRABALHO|EM L|ESCRITÓRIO|ESCRITORIO/.test(e) || /^MESA$/.test(e) },
      { label: "Mesa Plástica",       match: e => /PLÁST|PLASTIC/.test(e) },
      { label: "Mesa p/ Computador",  match: e => /COMPUTADOR/.test(e) },
      { label: "Mesa p/ Impressora",  match: e => /IMPRESSORA/.test(e) },
      { label: "Mesa de Reunião",     match: e => /REUNI|CIRCULAR|RETANGUL/.test(e) },
      { label: "Outras Mesas",        match: () => true },
    ],
  },
  {
    name: "Armários", icon: "🗄️",
    re: /ARMÁRI|ARMARIO|ARQUIVO|ESTANTE|GAVETEIRO|RACK|PRATELEIRA|ROUPEIRO/,
    subs: [
      { label: "Arquivo",              match: e => /ARQUIVO/.test(e) },
      { label: "Armário em Aço",       match: e => /(ARMÁRI|ARMARIO)/.test(e) && /AÇO|ACO/.test(e) },
      { label: "Armário em MDF/Madeira", match: e => /ARMÁRI|ARMARIO/.test(e) },
      { label: "Estante em Aço",       match: e => /ESTANTE/.test(e) && /AÇO|ACO/.test(e) },
      { label: "Estante",              match: e => /ESTANTE/.test(e) },
      { label: "Gaveteiro",            match: e => /GAVETEIRO/.test(e) },
      { label: "Rack / Suporte",       match: () => true },
    ],
  },
  {
    name: "Informática", icon: "💻",
    re: /NOTEBOOK|COMPUTADOR|MICROCOMPUTADOR|CPU|LAPTOP|TABLET|DESKTOP|SCANNER|IMPRESSORA|MULTIFUNCIONAL|MONITOR|FRAGMENTADORA|ESTAÇÃO DE TRABALHO|MICRO COMPUTADOR/,
    subs: [
      { label: "Notebook / Laptop",       match: e => /NOTEBOOK|LAPTOP/.test(e) },
      { label: "Tablet",                  match: e => /TABLET/.test(e) },
      { label: "Computador (Desktop)",    match: e => /COMPUTADOR|MICROCOMPUTADOR|CPU|DESKTOP|ESTAÇÃO|MICRO COMPUTADOR/.test(e) },
      { label: "Monitor",                 match: e => /MONITOR/.test(e) },
      { label: "Impressora",              match: e => /IMPRESSORA|MULTIFUNCIONAL/.test(e) },
      { label: "Scanner",                 match: e => /SCANNER/.test(e) },
      { label: "Fragmentadora",           match: e => /FRAGMENTADORA/.test(e) },
      { label: "Acessórios",              match: () => true },
    ],
  },
  {
    name: "TV / AV", icon: "📺",
    re: /TELEVISOR|TV |PROJETOR|TELÃO|DISPLAY|TELA|DATA SHOW/,
    subs: [
      { label: "Televisor",          match: e => /TELEVISOR|^TV /.test(e) },
      { label: "Projetor",           match: e => /PROJETOR|DATA SHOW/.test(e) },
      { label: "Tela de Projeção",   match: e => /TELA/.test(e) },
      { label: "Outros",             match: () => true },
    ],
  },
  {
    name: "Climatização", icon: "❄️",
    re: /AR CONDICIONADO|VENTILADOR|CLIMATIZADOR|EXAUSTOR|SPLIT|PURIFICADOR/,
    subs: [
      { label: "Ar-Condicionado",        match: e => /AR CONDICIONADO|SPLIT/.test(e) },
      { label: "Ventilador de Parede",   match: e => /VENTILADOR/.test(e) && /PAREDE/.test(e) },
      { label: "Ventilador de Coluna",   match: e => /VENTILADOR/.test(e) && /COLUNA/.test(e) },
      { label: "Ventilador Geral",       match: e => /VENTILADOR|CLIMATIZADOR|EXAUSTOR/.test(e) },
      { label: "Purificador",            match: () => true },
    ],
  },
  {
    name: "Rede / TI", icon: "🔌",
    re: /CÂMERA|CAMERA|ROTEADOR|SWITCH|NOBREAK|ESTABILIZADOR|SERVIDOR|HUB|MICROFONE|CAIXA AMPLIF|DVR|KIT DE SEGUR|MINI SYSTEM/,
    subs: [
      { label: "Câmera de Segurança",     match: e => /CÂMERA|CAMERA|DVR|KIT DE SEGUR/.test(e) },
      { label: "Switch / Roteador",       match: e => /SWITCH|ROTEADOR|HUB|SERVIDOR/.test(e) },
      { label: "Nobreak",                 match: e => /NOBREAK/.test(e) },
      { label: "Estabilizador",           match: e => /ESTABILIZADOR/.test(e) },
      { label: "Caixa de Som / Microfone",match: () => true },
    ],
  },
  {
    name: "Cozinha", icon: "🍳",
    re: /LIQUIDIFICADOR|GELADEIRA|FOGÃO|MICROONDAS|CAFETEIRA|BEBEDOURO|FREEZER|FORNO|FILTRO|REFRIGERADOR|FOGAO|FRIGOBAR|BATEDEIRA|MAQUINA DE LAVAR/,
    subs: [
      { label: "Bebedouro",                   match: e => /BEBEDOURO/.test(e) },
      { label: "Geladeira / Refrigerador",    match: e => /GELADEIRA|REFRIGERADOR|FRIGOBAR|FREEZER/.test(e) },
      { label: "Fogão",                       match: e => /FOGÃO|FOGAO/.test(e) },
      { label: "Liquidificador",              match: e => /LIQUIDIFICADOR/.test(e) },
      { label: "Eletrodomésticos Diversos",   match: () => true },
    ],
  },
  {
    name: "Saúde / Repouso", icon: "🏥",
    re: /\bCAMA\b|MACA|COLCHÃO|BERÇO|BERCE/,
    subs: [
      { label: "Cama / Colchão",  match: e => /CAMA|COLCHÃO/.test(e) },
      { label: "Berço",           match: e => /BERÇO|BERCE/.test(e) },
      { label: "Maca",            match: () => true },
    ],
  },
  {
    name: "Outros", icon: "📦",
    re: null, // catch-all
    subs: [
      { label: "Veículos",              match: e => /AUTOMÓVEL|MICROÔNIBUS|ÔNIBUS|CAMINHÃO/.test(e) },
      { label: "Mobiliário Diverso",    match: e => /SOFÁ|SOFA|ESCRIVANINHA|CONJUNTO REFEIT/.test(e) },
      { label: "Sinalização / Expo",    match: e => /QUADRO|CAVALETE|MURAL|BANNER/.test(e) },
      { label: "Relógio de Ponto",      match: e => /RELÓGIO/.test(e) },
      { label: "Equipamentos Diversos", match: () => true },
    ],
  },
];

function getCategoryGroup(especie) {
  const e = String(especie || "").toUpperCase();
  for (const c of CATEGORY_TREE) {
    if (c.re && c.re.test(e)) return c.name;
  }
  return "Outros";
}

function getSubcategoryLabel(especie, catName) {
  const e = String(especie || "").toUpperCase();
  const cat = CATEGORY_TREE.find(c => c.name === catName);
  if (!cat) return null;
  for (const s of cat.subs) {
    if (s.match(e)) return s.label;
  }
  return null;
}


// ══════════════════════════════════════════════════════════════
// PASSO 2 — Substituir o bloco {tab === "itens" && ( ... )}
// ══════════════════════════════════════════════════════════════

{tab === "itens" && (
  <div>
    {(() => {
      const [localCat,  setLocalCat]  = React.useState("Todas");
      const [localSub,  setLocalSub]  = React.useState(null);
      const [localEst,  setLocalEst]  = React.useState("Todos");
      const [localUnit, setLocalUnit] = React.useState("Todas");
      const [localStat, setLocalStat] = React.useState("Todos");
      const [localQ,    setLocalQ]    = React.useState("");
      const [localPage, setLocalPage] = React.useState(1);
      const IPER = 24;

      const base = todosItens;

      /* ── contagens ── */
      const catCounts = React.useMemo(() => {
        const m = { Todas: base.length };
        for (const i of base) {
          const g = getCategoryGroup(i.especie);
          m[g] = (m[g] || 0) + 1;
        }
        return m;
      }, [base.length]);

      const subCounts = React.useMemo(() => {
        if (localCat === "Todas") return {};
        const m = {};
        for (const i of base) {
          if (getCategoryGroup(i.especie) !== localCat) continue;
          const s = getSubcategoryLabel(i.especie, localCat) || "Outros";
          m[s] = (m[s] || 0) + 1;
        }
        return m;
      }, [base.length, localCat]);

      /* ── active subcategory defs ── */
      const activeCatDef = CATEGORY_TREE.find(c => c.name === localCat) || null;

      /* ── filtro ── */
      const filtered = React.useMemo(() => {
        const q = localQ.toLowerCase().trim();
        return base.filter((i) => {
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
          if (q && !(
            i.id.toLowerCase().includes(q) ||
            (i.descricao  || "").toLowerCase().includes(q) ||
            (i.especie    || "").toLowerCase().includes(q) ||
            (i.marca      || "").toLowerCase().includes(q) ||
            (i.fornecedor || "").toLowerCase().includes(q) ||
            (i.nf         || "").toLowerCase().includes(q)
          )) return false;
          return true;
        });
      }, [base, localCat, localSub, localEst, localUnit, localStat, localQ]);

      const totalPages = Math.max(1, Math.ceil(filtered.length / IPER));
      const curPage    = Math.min(localPage, totalPages);
      const paged      = filtered.slice((curPage - 1) * IPER, curPage * IPER);
      const resetPage  = () => setLocalPage(1);

      const selectCat = (name) => { setLocalCat(name); setLocalSub(null); resetPage(); };
      const selectSub = (sub)  => { setLocalSub(sub);  resetPage(); };

      /* ── sidebar ── */
      const SidebarCatBtn = ({ cat }) => {
        const active = localCat === cat.name;
        return (
          <button
            onClick={() => selectCat(cat.name)}
            style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%",
              background: active ? "#1e3a8a" : "transparent",
              color: active ? "#fff" : "#374151",
              border: "none", borderRadius: 8, padding: "8px 10px",
              fontSize: 13, fontWeight: active ? 700 : 500, cursor: "pointer",
              marginBottom: 2, textAlign: "left",
            }}
          >
            <span style={{ fontSize: 16 }}>{cat.icon}</span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {cat.name}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700, flexShrink: 0,
              background: active ? "rgba(255,255,255,.2)" : "#e2e8f0",
              color: active ? "#fff" : "#64748b",
              borderRadius: 99, padding: "1px 6px",
            }}>
              {catCounts[cat.name] || 0}
            </span>
          </button>
        );
      };

      const SidebarSubBtn = ({ sub }) => {
        const active = localSub === sub;
        const count  = subCounts[sub] || 0;
        return (
          <button
            onClick={() => selectSub(active ? null : sub)}
            style={{
              display: "flex", alignItems: "center", gap: 6, width: "100%",
              background: active ? "#dbeafe" : "transparent",
              color: active ? "#1d4ed8" : "#6b7280",
              border: `1px solid ${active ? "#93c5fd" : "transparent"}`,
              borderRadius: 7, padding: "6px 8px 6px 28px",
              fontSize: 12, fontWeight: active ? 700 : 400, cursor: "pointer",
              marginBottom: 1, textAlign: "left",
            }}
          >
            <span style={{ fontSize: 10, opacity: 0.5 }}>└</span>
            <span style={{ flex: 1 }}>{sub}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, flexShrink: 0,
              color: active ? "#1d4ed8" : "#94a3b8",
            }}>
              {count}
            </span>
          </button>
        );
      };

      /* ── card ── */
      const ItemCard = ({ item }) => {
        const f    = foundMap[item.id];
        const foto = f?.fotoUrls?.[0];
        const isF  = !!f;
        const catDef = CATEGORY_TREE.find(c => getCategoryGroup(item.especie) === c.name)
          || CATEGORY_TREE[CATEGORY_TREE.length - 1];

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
              display: "flex", flexDirection: "column",
            }}
          >
            {/* foto / placeholder */}
            <div style={{
              width: "100%", height: 130, flexShrink: 0, position: "relative",
              background: foto ? "#000" : (isF ? "#f0fdf4" : "#f8fafc"),
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
            }}>
              {foto ? (
                <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 32, opacity: isF ? 0.5 : 0.2 }}>{catDef.icon}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: isF ? "#16a34a" : "#94a3b8", letterSpacing: ".05em" }}>
                    {isF ? "✅ SEM FOTO" : "📷 PENDENTE"}
                  </span>
                </div>
              )}
              <div style={{
                position: "absolute", top: 5, right: 5,
                background: isF ? "#16a34a" : "#f59e0b",
                borderRadius: 99, width: 9, height: 9, boxShadow: "0 0 0 2px #fff",
              }} />
              {(f?.fotoUrls?.length || 0) > 1 && (
                <div style={{
                  position: "absolute", bottom: 5, right: 5,
                  background: "rgba(0,0,0,.55)", color: "#fff",
                  borderRadius: 99, fontSize: 9, fontWeight: 700, padding: "2px 6px",
                }}>
                  📷 {f.fotoUrls.length}
                </div>
              )}
            </div>

            {/* corpo */}
            <div style={{ padding: "9px 10px 10px", flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <p style={{
                margin: 0, fontSize: 11, fontWeight: 800, color: "#0f172a", lineHeight: 1.3,
                overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box",
                WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              }}>
                {item.descricao || item.especie || "—"}
              </p>
              <p style={{ margin: 0, fontSize: 9, color: "#64748b", fontWeight: 600 }}>Nº {item.id}</p>
              <p style={{
                margin: "1px 0 0", fontSize: 9, color: "#94a3b8",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {(item.unidadeNome || "").replace(/^\d+[\d.]*\s*-\s*/, "").slice(0, 36)}
              </p>
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 3 }}>
                {isF ? <Badge label={f.estado} c={EC[f.estado]} /> : <Badge label="Pendente" c={{ bg: "#fff7ed", tx: "#c2410c" }} />}
                {item.tipoEntrada && item.tipoEntrada !== "Próprio" && (
                  <Badge label={item.tipoEntrada}
                    c={item.tipoEntrada === "Doação" ? { bg: "#fef3c7", tx: "#92400e" } : { bg: "#d1fae5", tx: "#065f46" }} />
                )}
              </div>
              <p style={{ margin: "3px 0 0", fontSize: 10, color: "#059669", fontWeight: 700 }}>
                R$ {(item.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        );
      };

      const unitOptions = unidades.map(u => ({
        id: u.id,
        label: u.nome.replace(/^\d+[\d.]*\s*-\s*/, "").slice(0, 52),
      }));

      /* ── mobile: chips de categoria e sub ── */
      const MobileChips = ({ items, selected, onSelect, size = 12 }) => (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 8 }}>
          {items.map(item => {
            const active = selected === (item.name || item);
            const label  = item.name || item;
            const icon   = item.icon || "";
            return (
              <button key={label} onClick={() => onSelect(active ? null : label)}
                style={{
                  flexShrink: 0, display: "flex", alignItems: "center", gap: 4,
                  background: active ? "#1e3a8a" : "#f1f5f9",
                  color: active ? "#fff" : "#374151",
                  border: `1.5px solid ${active ? "#1e3a8a" : "#e2e8f0"}`,
                  borderRadius: 99, padding: "5px 10px",
                  fontSize: size, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                }}>
                {icon && <span>{icon}</span>}{label}
              </button>
            );
          })}
        </div>
      );

      return (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

          {/* ── SIDEBAR desktop ── */}
          {!isMob && (
            <div style={{
              width: 200, flexShrink: 0, background: "#fff", borderRadius: 12,
              padding: "12px 8px", boxShadow: "0 1px 3px rgba(0,0,0,.06)",
              position: "sticky", top: 80,
              maxHeight: "calc(100vh - 100px)", overflowY: "auto",
            }}>
              {/* "Todas" */}
              <button
                onClick={() => selectCat("Todas")}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  background: localCat === "Todas" ? "#1e3a8a" : "transparent",
                  color: localCat === "Todas" ? "#fff" : "#374151",
                  border: "none", borderRadius: 8, padding: "8px 10px",
                  fontSize: 13, fontWeight: localCat === "Todas" ? 700 : 500, cursor: "pointer",
                  marginBottom: 6, textAlign: "left",
                }}
              >
                <span style={{ fontSize: 16 }}>🗂️</span>
                <span style={{ flex: 1 }}>Todos</span>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  background: localCat === "Todas" ? "rgba(255,255,255,.2)" : "#e2e8f0",
                  color: localCat === "Todas" ? "#fff" : "#64748b",
                  borderRadius: 99, padding: "1px 6px",
                }}>
                  {catCounts.Todas || 0}
                </span>
              </button>

              {/* categorias */}
              {CATEGORY_TREE.map(cat => (
                <React.Fragment key={cat.name}>
                  <SidebarCatBtn cat={cat} />
                  {/* sub-categorias expandidas */}
                  {localCat === cat.name && cat.subs && (
                    <div style={{ marginBottom: 4 }}>
                      {cat.subs
                        .filter(s => subCounts[s.label] > 0)
                        .map(s => (
                          <SidebarSubBtn key={s.label} sub={s.label} />
                        ))}
                    </div>
                  )}
                </React.Fragment>
              ))}

              <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "10px 0 8px" }} />
              <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", padding: "0 4px" }}>
                Status
              </p>
              {[
                { key: "Todos",         label: "📋 Todos" },
                { key: "Inventariados", label: "✅ Inventariados" },
                { key: "Pendentes",     label: "⏳ Pendentes" },
              ].map(s => (
                <button key={s.key} onClick={() => { setLocalStat(s.key); resetPage(); }}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    background: localStat === s.key ? "#1e3a8a" : "transparent",
                    color: localStat === s.key ? "#fff" : "#374151",
                    border: "none", borderRadius: 8, padding: "7px 10px",
                    fontSize: 12, fontWeight: localStat === s.key ? 700 : 500, cursor: "pointer", marginBottom: 2,
                  }}>
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* ── CONTEÚDO PRINCIPAL ── */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* header */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🪑 Itens</h2>
                {localCat !== "Todas" && (
                  <span style={{ fontSize: 13, color: "#1e3a8a", fontWeight: 700 }}>
                    {CATEGORY_TREE.find(c=>c.name===localCat)?.icon} {localCat}
                    {localSub && <span style={{ color: "#64748b", fontWeight: 500 }}> › {localSub}</span>}
                  </span>
                )}
              </div>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
                {filtered.length.toLocaleString("pt-BR")} item(s)
              </p>
            </div>

            {/* chips mobile — categorias */}
            {isMob && (
              <>
                <MobileChips
                  items={[{ name: "Todas", icon: "🗂️" }, ...CATEGORY_TREE]}
                  selected={localCat}
                  onSelect={name => selectCat(name || "Todas")}
                />
                {/* chips mobile — subcategorias */}
                {localCat !== "Todas" && activeCatDef && (
                  <MobileChips
                    items={activeCatDef.subs
                      .filter(s => subCounts[s.label] > 0)
                      .map(s => s.label)}
                    selected={localSub}
                    onSelect={sub => selectSub(sub)}
                    size={11}
                  />
                )}
                {/* status mobile */}
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {["Todos", "Inventariados", "Pendentes"].map(s => (
                    <button key={s} onClick={() => { setLocalStat(s); resetPage(); }}
                      style={{
                        flex: 1, background: localStat === s ? "#1e3a8a" : "#f1f5f9",
                        color: localStat === s ? "#fff" : "#374151",
                        border: "none", borderRadius: 8, padding: "7px 4px",
                        fontSize: 11, fontWeight: 700, cursor: "pointer",
                      }}>
                      {s === "Todos" ? "📋 Todos" : s === "Inventariados" ? "✅" : "⏳"}
                      {s !== "Todos" ? ` ${s.slice(0, 9)}` : ""}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* barra de filtros */}
            <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "2fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
              <TInput
                initial=""
                onVal={v => { setLocalQ(v); resetPage(); }}
                placeholder="🔍 Buscar descrição, Nº, marca, NF..."
                style={inp}
              />
              <select value={localEst} onChange={e => { setLocalEst(e.target.value); resetPage(); }} style={inp}>
                <option value="Todos">Estado: Todos</option>
                {ESTADOS.map(e => <option key={e}>{e}</option>)}
              </select>
              <select value={localUnit} onChange={e => { setLocalUnit(e.target.value); resetPage(); }} style={inp}>
                <option value="Todas">Unidade: Todas</option>
                {unitOptions.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </div>

            {/* grid */}
            {paged.length === 0 ? (
              <div style={{ ...cd, textAlign: "center", padding: 48 }}>
                <p style={{ fontSize: 40, margin: "0 0 8px" }}>🔍</p>
                <p style={{ color: "#94a3b8", margin: 0 }}>Nenhum item com esses filtros.</p>
                <button onClick={() => { selectCat("Todas"); setLocalStat("Todos"); setLocalEst("Todos"); }}
                  style={{ ...bs, marginTop: 12, fontSize: 12 }}>
                  Limpar filtros
                </button>
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: isMob
                  ? "repeat(2, 1fr)"
                  : "repeat(auto-fill, minmax(185px, 1fr))",
                gap: 10,
              }}>
                {paged.map(item => (
                  <ItemCard key={`${item.unidadeId}_${item.id}`} item={item} />
                ))}
              </div>
            )}

            {/* paginação */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
                <button onClick={() => setLocalPage(1)} disabled={curPage===1} style={{...bs, padding:"6px 10px", fontSize:12}}>«</button>
                <button onClick={() => setLocalPage(p=>Math.max(1,p-1))} disabled={curPage===1} style={{...bs, padding:"6px 10px", fontSize:12}}>‹</button>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Pág {curPage}/{totalPages} · {filtered.length.toLocaleString("pt-BR")} itens
                </span>
                <button onClick={() => setLocalPage(p=>Math.min(totalPages,p+1))} disabled={curPage===totalPages} style={{...bs, padding:"6px 10px", fontSize:12}}>›</button>
                <button onClick={() => setLocalPage(totalPages)} disabled={curPage===totalPages} style={{...bs, padding:"6px 10px", fontSize:12}}>»</button>
              </div>
            )}
          </div>
        </div>
      );
    })()}
  </div>
)}
