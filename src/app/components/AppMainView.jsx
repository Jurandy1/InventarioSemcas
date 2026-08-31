import React, { Suspense } from "react";
import { CameraModal } from "../../components/CameraModal.jsx";
import { EC, ESTADOS, SITUACOES } from "../../constants/inventory.js";
import { isStorageOk } from "../../services/storage.js";
import { clearUiResume } from "../../utils/uiResume.js";
import { defaultEstadoForItem, inferEspecieFromDesc } from "../../utils/itemHelpers.js";
import { isSemTomboItem } from "../../utils/semTombo.js";
import { getFoundEntry } from "../../utils/patrimonioId.js";
import { rankTombosForAjuste } from "../../utils/ajusteMatch.js";
import { gerarSugestoesEspecie } from "../../utils/suggestions.js";
import { ImageOverlay, Overlay } from "../../components/Overlay.jsx";
import { ToastNotification } from "../../components/ToastNotification.jsx";
import { NavBar } from "../../components/NavBar.jsx";
import { ItemDetailModal } from "../../components/ItemDetailModal.jsx";
import { LoginPage } from "../../pages/LoginPage.jsx";
import { CoordenadoresTab } from "../admin/CoordenadoresTab.jsx";
import { InventariantesTab } from "../admin/InventariantesTab.jsx";
import { ManualModal } from "../../components/modals/ManualModal.jsx";
import { SemTomboModal } from "../../components/modals/SemTomboModal.jsx";
import { AddLocalModal } from "../../components/modals/AddLocalModal.jsx";
import { FinalizarModal } from "../../components/modals/FinalizarModal.jsx";
import { LocalDetailModal } from "../../components/modals/LocalDetailModal.jsx";
import { MultiItemModal } from "../../components/modals/MultiItemModal.jsx";
import { AjusteLinkModal } from "../../components/modals/AjusteLinkModal.jsx";
import { registrarEdicaoFinalizacao } from "../../services/finalizacoes.js";
import { getItemCode } from "../helpers/appHelpers.js";
import {
  tabFallback,
  LazyTombosPage,
  LazyDashboardPage,
  LazyInventarioPage,
  LazyBuscaPage,
  LazyItensPage,
  LazyNotasFiscaisPage,
  LazyFinalizadosPage,
  LazyCorrecaoNomesPage,
} from "../lazyPages.jsx";
export function AppMainView({ ctx }) {
  const {
    auth, firebaseOk, isProd, tab, setTab, busy, isMob, toast, modal, setModal,
    qrCodeUrl, setQrCodeUrl, coordRegistroLink, setCoordRegistroLink,
    invConviteLink, setInvConviteLink, invConviteExp, gerandoInvConvite,
    localDetalhe, setLocalDetalhe, cameraTarget, search, setSearch, hideFound, setHideFound,
    hideIncorporados, persistHideIncorporados, tombosTab, setTombosTab,
    globalSearch, setGlobalSearch, globalResults, globalSearching,
    nfSearch, setNfSearch, nfTipo, setNfTipo, nfPage, setNfPage,
    ft, imgViewSrc, setImgViewSrc, overlayBackdropSuppressMs,
    teamOnline, saveConflict, setSaveConflict, finalizadoEdit, setFinalizadoEdit,
    formRef, bumpFt, setField, getField, revokeBlobUrls, showT, onViewImage,
    unidades, loadingXlsx, loadXlsx, found, locais, inventario, unidadeAtiva,
    editScopeUnits, editScopeSessionId, sessionLocais, pickLocais,
    handleDeleteLocal, handleDeleteInventariado, createSessionLocal, campanhaState, finalizacoesState,
    abrirConvidarColega, renderOfflineStatus, todosItens, sugestoes,
    aplicarCorrecaoNomes, tombosDup, nfDataList, NF_PER_PAGE, xlsxCorrompidos,
    sessionTotalFound, sessionTotalBens, sessionProgresso, sortedFiltered,
    origemMeta, inp, bp, bs, cd, isAdmin, canGerirCoord, navs,
    doGlobalSearch, openDetModal, openNextPending, openCamera, onCameraCapture,
    closeCameraModal, closeDetModal, applyServerEntryToDetForm, addManual,
    addSemTomboItem, addMultiItems, addSemTomboPendentes, openLinkTomboModal,
    linkSemTomboToTombo, corrigirParaSemTombo, confirmarTomboDivergente, getSemTomboPendentes,
    toggleStPending, gerarRelatorio, fazerBackup, finalizarComCoordenadora,
    multiRowsPhotosRef, multiSharedRef, multiRowsRef, manualPatrimonioRef,
    lookupTombo, quickMarkFound, persistCameraSession, saveSessionResume, resolveItemUnit,
    assertPodeEditar, scopeAllItens, updateQueueStatus,
  } = ctx;

  if (auth.loading)
    return (
      <div className="gov-loading">
        <div className="gov-spinner" aria-hidden="true" />
        <p style={{ color: "var(--gov-text-muted)", fontSize: 13 }}>Carregando inventário...</p>
      </div>
    );

  if (!auth.logado)
    return (
      <LoginPage
        firebaseOk={firebaseOk}
        isProd={isProd}
        loginError={auth.loginError}
        onEmail={(v) => setField("email", v)}
        onSenha={(v) => setField("senha", v)}
        onSubmit={() => auth.login(getField("email"), getField("senha"))}
        inp={inp}
        bp={bp}
      />
    );

  const banner =
    found.uploading && (
      <div className="gov-banner gov-banner--info">
        {found.uploadMsg || "Enviando fotos..."}
      </div>
    );

  return (
    <div style={{ minHeight: "100vh", background: "var(--gov-bg)" }}>
      {campanhaState.fechada && (
        <div className="gov-banner gov-banner--danger">
          Inventário fechado — apenas consulta. Novos registros estão bloqueados.
        </div>
      )}
      <NavBar
        navs={navs}
        activeTab={tab}
        onTabChange={setTab}
        isMobile={isMob}
        logado={auth.logado}
        unidadesAtivas={inventario.unidadesAtivas}
        offlineStatus={renderOfflineStatus()}
        banner={banner}
        onReloadXlsx={() => loadXlsx(true)}
        loadingXlsx={loadingXlsx}
        onLogout={auth.logout}
        storageOk={isStorageOk()}
      >
        {tab === "inventario" && (
          <Suspense fallback={tabFallback}>
          <LazyInventarioPage
            invSubTab={inventario.invSubTab}
            setInvSubTab={inventario.setInvSubTab}
            unidades={unidades}
            unidadesAtivas={inventario.unidadesAtivas}
            pendingUnids={inventario.pendingUnids}
            setPendingUnids={inventario.setPendingUnids}
            confirmarAtivas={inventario.confirmarAtivas}
            removeAtiva={inventario.removeAtiva}
            retomarSessaoPausada={inventario.retomarSessaoPausada}
            descartarSessaoPausada={inventario.descartarSessaoPausada}
            sessoesPausadas={inventario.sessoesPausadas}
            pausedUnitIds={inventario.pausedUnitIds}
            finalizacoes={finalizacoesState.finalizacoes}
            foundSet={found.foundSet}
            foundMap={found.foundMap}
            activeLocalId={inventario.activeLocalId}
            setActiveLocalId={inventario.setActiveLocalId}
            isMob={isMob}
            cd={cd}
            inp={inp}
            bp={bp}
            bs={bs}
            totalFound={sessionTotalFound}
            totalBens={sessionTotalBens}
            progresso={sessionProgresso}
            hideIncorporados={hideIncorporados}
            setHideIncorporados={persistHideIncorporados}
            filtered={sortedFiltered}
            search={search}
            setSearch={setSearch}
            hideFound={hideFound}
            setHideFound={setHideFound}
            openDetModal={openDetModal}
            onOpenLocalDetail={(local) => setLocalDetalhe(local)}
            onOpenMulti={() => {
              if (!multiSharedRef.current) {
                multiSharedRef.current = {
                  descricao: "",
                  especie: "",
                  marca: "",
                  fornecedor: "",
                  valor: "",
                  localId: sessionLocais[0]?.id || "",
                  origem: "Próprio",
                  corPadrao: "",
                  multiDoacaoModo: "uf",
                  multiDoacaoUf: "MA",
                  multiDoacaoTexto: "",
                };
              }
              if (!multiRowsRef.current) {
                multiRowsRef.current = [
                  { tombamento: "", estado: "Bom", obs: "", cor: "" },
                  { tombamento: "", estado: "Bom", obs: "", cor: "" },
                ];
              }
              multiRowsPhotosRef.current = {};
              setModal("multi");
            }}
            onOpenManual={(localId) => {
              formRef.current = {
                manEstado: defaultEstadoForItem({ data: new Date().toLocaleDateString("pt-BR") }),
                manPatrimonio: "",
                manLocal: String(localId || ""),
                manQtd: 1,
                manSharePhotos: true,
                manOrigem: "Próprio",
                manCor: "",
                manDoacaoModo: "uf",
                manDoacaoUf: "MA",
                manDoacaoTexto: "",
              };
              bumpFt();
              setModal("manual");
            }}
            onOpenSemTombo={(localId) => {
              formRef.current = {
                stMode: "novo",
                stDesc: "",
                stLocal: String(localId || sessionLocais[0]?.id || ""),
                stUnidadeId: unidadeAtiva?.id || inventario.unidadesAtivas[0]?.id || "",
                stEstado: "Bom",
                stObs: "",
                stTomboRef: "",
                stMarca: "",
                stOrigem: "Próprio",
                stDoacaoModo: "uf",
                stDoacaoUf: "MA",
                stDoacaoTexto: "",
                stPhotos: [],
                stSelectedIds: [],
                stPendSearch: "",
              };
              bumpFt();
              setModal("semTombo");
            }}
            onOpenFotoVarios={() => {
              formRef.current = {
                stMode: "pendentes",
                stDesc: "",
                stLocal: String(sessionLocais[0]?.id || ""),
                stUnidadeId: unidadeAtiva?.id || inventario.unidadesAtivas[0]?.id || "",
                stEstado: "Bom",
                stObs: "",
                stTomboRef: "",
                stMarca: "",
                stOrigem: "Próprio",
                stDoacaoModo: "uf",
                stDoacaoUf: "MA",
                stDoacaoTexto: "",
                stPhotos: [],
                stSelectedIds: [],
                stPendSearch: "",
              };
              bumpFt();
              setModal("semTombo");
            }}
            onOpenLinkTombo={openLinkTomboModal}
            onOpenFinalizar={() => setModal("finalizar")}
            onOpenCancelar={() => setModal("cancelar-inventario")}
            onOpenConvidarColega={isAdmin ? abrirConvidarColega : undefined}
            sessionId={inventario.sessionId}
            locais={sessionLocais}
            onOpenNextPending={openNextPending}
            lookupTombo={lookupTombo}
            onQuickMarkFound={quickMarkFound}
            campanhaFechada={campanhaState.fechada}
            teamOnline={teamOnline}
            myUid={auth.logado?.uid || ""}
            onQuickAddLocal={async (nome) => {
              const entry = await createSessionLocal(nome);
              if (entry) showT("Local da sessão adicionado");
            }}
            onDeleteLocal={handleDeleteLocal}
            onDeleteItem={handleDeleteInventariado}
            showT={showT}
            onViewImage={onViewImage}
          />
          </Suspense>
        )}

        {tab === "finalizados" && (
          <Suspense fallback={tabFallback}>
          <LazyFinalizadosPage
            finalizacoes={finalizacoesState.finalizacoes}
            todosItens={todosItens}
            unidades={unidades}
            loading={finalizacoesState.loading}
            onRefresh={finalizacoesState.refresh}
            editFin={finalizadoEdit?.fin || null}
            editUnits={finalizadoEdit?.units || []}
            onEdit={(fin) => {
              const units = (fin.unidadeIds || []).map((id) => unidades.find((u) => u.id === id)).filter(Boolean);
              if (!units.length) {
                showT("Unidade não encontrada no cadastro");
                return;
              }
              setFinalizadoEdit({ fin, units });
              registrarEdicaoFinalizacao(fin.id, auth.logado);
            }}
            onCloseEdit={() => setFinalizadoEdit(null)}
            foundSet={found.foundSet}
            foundMap={found.foundMap}
            locais={sessionLocais}
            isMob={isMob}
            cd={cd}
            inp={inp}
            bp={bp}
            bs={bs}
            openDetModal={openDetModal}
            onOpenLocalDetail={(local) => setLocalDetalhe(local)}
            onOpenSemTombo={(localId) => {
              formRef.current = {
                stMode: "novo",
                stDesc: "",
                stLocal: String(localId || sessionLocais[0]?.id || ""),
                stUnidadeId: unidadeAtiva?.id || editScopeUnits[0]?.id || "",
                stEstado: "Bom",
                stObs: "",
                stTomboRef: "",
                stMarca: "",
                stPhotos: [],
                stSelectedIds: [],
                stPendSearch: "",
              };
              bumpFt();
              setModal("semTombo");
            }}
            onOpenFotoVarios={() => {
              formRef.current = {
                stMode: "pendentes",
                stDesc: "",
                stLocal: String(sessionLocais[0]?.id || ""),
                stUnidadeId: unidadeAtiva?.id || editScopeUnits[0]?.id || "",
                stEstado: "Bom",
                stObs: "",
                stTomboRef: "",
                stMarca: "",
                stPhotos: [],
                stSelectedIds: [],
                stPendSearch: "",
              };
              bumpFt();
              setModal("semTombo");
            }}
            onOpenLinkTombo={openLinkTomboModal}
            onConfirmTomboDivergente={confirmarTomboDivergente}
            onOpenManual={(localId) => {
              formRef.current = {
                manEstado: defaultEstadoForItem({ data: new Date().toLocaleDateString("pt-BR") }),
                manPatrimonio: "",
                manLocal: String(localId || sessionLocais[0]?.id || ""),
                manQtd: 1,
                manSharePhotos: true,
                manCor: "",
              };
              bumpFt();
              setModal("manual");
            }}
            sessionId={editScopeSessionId}
            showT={showT}
            onQuickAddLocal={async (nome) => {
              const entry = await createSessionLocal(nome);
              if (entry) showT("Local adicionado");
            }}
            onDeleteLocal={handleDeleteLocal}
            onViewImage={onViewImage}
            campanhaFechada={campanhaState.fechada}
            logado={auth.logado}
          />
          </Suspense>
        )}

        {tab === "busca" && (
          <Suspense fallback={tabFallback}>
          <LazyBuscaPage
            globalSearch={globalSearch}
            globalResults={globalResults}
            globalSearching={globalSearching}
            onSearchChange={(v) => {
              setGlobalSearch(v);
              clearTimeout(formRef.current._gsT);
              formRef.current._gsT = setTimeout(() => doGlobalSearch(v), 300);
            }}
            onOpenItem={(item) => openDetModal(item)}
            foundMap={found.foundMap}
            unidades={unidades}
            saveAtiva={inventario.saveAtiva}
            isMob={isMob}
            inp={inp}
            cd={cd}
          />
          </Suspense>
        )}

        {tab === "itens" && (
          <Suspense fallback={tabFallback}>
          <LazyItensPage
            todosItens={todosItens}
            unidades={unidades}
            foundMap={found.foundMap}
            foundSet={found.foundSet}
            locais={locais.locais}
            saveAtiva={inventario.saveAtiva}
            formRef={formRef}
            bumpFt={bumpFt}
            setModal={setModal}
            isMob={isMob}
            inp={inp}
            cd={cd}
            bs={bs}
            bp={bp}
            showT={showT}
            onViewImage={onViewImage}
          />
          </Suspense>
        )}

        {tab === "nf" && (
          <Suspense fallback={tabFallback}>
          <LazyNotasFiscaisPage
            nfDataList={nfDataList}
            nfSearch={nfSearch}
            setNfSearch={setNfSearch}
            nfTipo={nfTipo}
            setNfTipo={setNfTipo}
            nfPage={nfPage}
            setNfPage={setNfPage}
            NF_PER_PAGE={NF_PER_PAGE}
            origemMeta={origemMeta}
            foundSet={found.foundSet}
            foundMap={found.foundMap}
            unidades={unidades}
            saveAtiva={inventario.saveAtiva}
            onOpenItem={openDetModal}
            isMob={isMob}
            inp={inp}
            cd={cd}
            bs={bs}
          />
          </Suspense>
        )}

        {tab === "tombos" && (
          <Suspense fallback={tabFallback}>
            <LazyTombosPage tombosNE={found.tombosNE} tombosDup={tombosDup} tombosTab={tombosTab} setTombosTab={setTombosTab} isMob={isMob} bp={bp} bs={bs} cd={cd} />
          </Suspense>
        )}

        {tab === "dash" && (
          <Suspense fallback={tabFallback}>
            <LazyDashboardPage
              totalBens={inventario.totalBens}
              totalFound={inventario.totalFound}
              progresso={inventario.progresso}
              gerarRelatorio={gerarRelatorio}
              fazerBackup={fazerBackup}
              found={found.found}
              foundMap={found.foundMap}
              finalizacoes={finalizacoesState.finalizacoes}
              todosItens={todosItens}
              xlsxCorrompidos={xlsxCorrompidos}
              unidades={unidades}
              saveAtiva={inventario.saveAtiva}
              setTab={setTab}
              showT={showT}
              isMob={isMob}
              bp={bp}
              bs={bs}
              cd={cd}
              campanha={campanhaState.campanha}
              campanhaFechada={campanhaState.fechada}
              onFecharCampanha={campanhaState.fechar}
              onReabrirCampanha={campanhaState.reabrir}
              isAdmin={canGerirCoord}
            />
          </Suspense>
        )}

        {tab === "coordenadores" && <CoordenadoresTab unidades={unidades} showT={showT} isMob={isMob} />}
        {tab === "correcao" && canGerirCoord && (
          <Suspense fallback={tabFallback}>
            <LazyCorrecaoNomesPage
              todosItens={todosItens}
              unidades={unidades}
              foundMap={found.foundMap}
              foundSet={found.foundSet}
              especies={gerarSugestoesEspecie(todosItens)}
              inferEspecieFromDesc={inferEspecieFromDesc}
              onAplicarCorrecao={aplicarCorrecaoNomes}
              onViewImage={onViewImage}
              onOpenItem={openDetModal}
              showT={showT}
              busy={busy}
              isMob={isMob}
              inp={inp}
              cd={cd}
              bs={bs}
            />
          </Suspense>
        )}
        {tab === "inventariantes" && <InventariantesTab showT={showT} isMob={isMob} />}
      </NavBar>

      {modal === "camera" && (
        <CameraModal
          existingPhotos={
            cameraTarget === "manual"
              ? formRef.current.manPhotos || []
              : cameraTarget === "semTombo"
                ? formRef.current.stPhotos || []
                : String(cameraTarget || "").startsWith("multi-row-")
                  ? multiRowsPhotosRef.current[String(cameraTarget).slice("multi-row-".length)] || []
                  : formRef.current.detNewBase64 || []
          }
          onCapture={onCameraCapture}
          onClose={closeCameraModal}
          onPhotosChange={persistCameraSession}
          onBeforeNativeCapture={() => saveSessionResume({ modal: "camera", cameraTarget: cameraTargetRef.current || "detalhe" })}
        />
      )}

      {modal === "detalhe" && formRef.current.detItem && (
        <Overlay
          isMobile={isMob}
          suppressBackdropMs={isMob ? Math.max(overlayBackdropSuppressMs, 1200) : overlayBackdropSuppressMs}
          onClose={closeDetModal}
        >
          <ItemDetailModal
            item={formRef.current.detItem}
            foundEntry={getFoundEntry(formRef.current.detItem.id, found.foundMap)}
            foundSet={found.foundSet}
            locais={pickLocais}
            origemMeta={origemMeta}
            isMobile={isMob}
            ft={ft}
            bumpFt={bumpFt}
            formRef={formRef}
            setField={setField}
            getField={getField}
            sugestoes={sugestoes}
            onOpenCamera={openCamera}
            onViewImage={onViewImage}
            onClose={closeDetModal}
            onSave={async () => {
              if (!assertPodeEditar()) return;
              formRef.current.detForceWrite = false;
              try {
                await found.saveDetail({
                  formRef,
                  getField,
                  unidadeAtiva: resolveItemUnit(formRef.current.detItem),
                  itemUnit: resolveItemUnit(formRef.current.detItem),
                  logado: auth.logado,
                  updateQueueStatus,
                  closeModal: closeDetModal,
                  onConflict: (serverEntry) => {
                    setSaveConflict({
                      serverEntry,
                      item: formRef.current.detItem,
                      who: serverEntry?.usuario || serverEntry?.user || "outro usuário",
                      when: serverEntry?.ultimaAtualizacao || serverEntry?.hora || "",
                    });
                  },
                });
              } catch (e) {
                console.error("Erro ao salvar item:", e);
                showT(e?.message || "Erro ao salvar o item");
                return;
              }
              if (getField("detLocal")) {
                inventario.setActiveLocalId(getField("detLocal"));
              }
            }}
            onDelete={async () => {
              if (!assertPodeEditar()) return;
              const item = formRef.current.detItem;
              const removed = await handleDeleteInventariado(item);
              if (removed) closeDetModal();
            }}
            onReassignTombo={() => {
              if (!assertPodeEditar()) return;
              const it = formRef.current.detItem;
              openLinkTomboModal(it, getFoundEntry(it.id, found.foundMap));
            }}
            onConvertSemTombo={corrigirParaSemTombo}
          />
        </Overlay>
      )}

      {saveConflict && (
        <Overlay isMobile={isMob} onClose={() => setSaveConflict(null)}>
          <div>
            <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: "#b45309" }}>Conflito ao salvar</h2>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
              <strong>{saveConflict.who}</strong> salvou este item
              {saveConflict.when ? ` (${new Date(saveConflict.when).toLocaleString("pt-BR")})` : ""}. Recarregar os dados do servidor?
            </p>
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  applyServerEntryToDetForm(saveConflict.serverEntry);
                  setSaveConflict(null);
                  showT("Dados recarregados do servidor");
                }}
                style={{ ...bp, flex: 1 }}
              >
                Recarregar
              </button>
              <button
                onClick={async () => {
                  formRef.current.detForceWrite = true;
                  setSaveConflict(null);
                  await found.saveDetail({
                    formRef,
                    getField,
                    unidadeAtiva: resolveItemUnit(formRef.current.detItem),
                    itemUnit: resolveItemUnit(formRef.current.detItem),
                    logado: auth.logado,
                    updateQueueStatus,
                    closeModal: closeDetModal,
                  });
                  if (getField("detLocal")) {
                    inventario.setActiveLocalId(getField("detLocal"));
                  }
                }}
                style={{ ...bs, flex: 1, color: "#b45309", borderColor: "#fcd34d" }}
              >
                Salvar mesmo assim
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {modal === "manual" && (
        <ManualModal
          isMob={isMob}
          overlayBackdropSuppressMs={overlayBackdropSuppressMs}
          revokeBlobUrls={revokeBlobUrls}
          formRef={formRef}
          clearUiResume={clearUiResume}
          setModal={setModal}
          getField={getField}
          setField={setField}
          inferEspecieFromDesc={inferEspecieFromDesc}
          sugestoes={sugestoes}
          bumpFt={bumpFt}
          manualPatrimonioRef={manualPatrimonioRef}
          bs={bs}
          inp={inp}
          bp={bp}
          ESTADOS={ESTADOS}
          EC={EC}
          SITUACOES={SITUACOES}
          pickLocais={pickLocais}
          openCamera={openCamera}
          onViewImage={onViewImage}
          addManual={addManual}
          ft={ft}
          lookupTombo={lookupTombo}
          onOpenExistingItem={(item) => {
            revokeBlobUrls(formRef.current.manPhotos || []);
            formRef.current.manPhotos = [];
            openDetModal(item);
          }}
        />
      )}

      {localDetalhe && (
        <LocalDetailModal
          local={localDetalhe}
          isMob={isMob}
          unidadesAtivas={inventario.unidadesAtivas}
          foundMap={found.foundMap}
          onClose={() => setLocalDetalhe(null)}
          onOpenItem={(item) => openDetModal(item)}
          onAddManual={(localId) => {
            setLocalDetalhe(null);
            formRef.current = {
              manEstado: defaultEstadoForItem({ data: new Date().toLocaleDateString("pt-BR") }),
              manPatrimonio: "",
              manLocal: String(localId || ""),
              manQtd: 1,
              manSharePhotos: true,
              manOrigem: "Próprio",
              manCor: "",
            };
            bumpFt();
            setModal("manual");
          }}
          onAddSemTombo={(localId) => {
            setLocalDetalhe(null);
            formRef.current = {
              stMode: "novo",
              stDesc: "",
              stLocal: String(localId || sessionLocais[0]?.id || ""),
              stUnidadeId: unidadeAtiva?.id || inventario.unidadesAtivas[0]?.id || "",
              stEstado: "Bom",
              stObs: "",
              stTomboRef: "",
              stMarca: "",
              stOrigem: "Próprio",
              stPhotos: [],
              stSelectedIds: [],
              stPendSearch: "",
            };
            bumpFt();
            setModal("semTombo");
          }}
          onViewImage={onViewImage}
          bp={bp}
          bs={bs}
        />
      )}

      {modal === "multi" && (
        <MultiItemModal
          isMob={isMob}
          unidadeAtiva={inventario.unidadesAtivas[0]}
          sessionLocais={sessionLocais}
          sugestoes={sugestoes}
          rowsPhotosRef={multiRowsPhotosRef}
          sharedRef={multiSharedRef}
          rowsRef={multiRowsRef}
          onClose={() => {
            Object.values(multiRowsPhotosRef.current || {}).forEach((arr) => revokeBlobUrls(arr));
            multiRowsPhotosRef.current = {};
            multiSharedRef.current = null;
            multiRowsRef.current = null;
            clearUiResume();
            setModal(null);
          }}
          onOpenCamera={(target) => openCamera(target)}
          onSubmit={addMultiItems}
          bp={bp}
          bs={bs}
          inp={inp}
        />
      )}

      {modal === "addLocal" && (
        <AddLocalModal
          isMob={isMob}
          setModal={setModal}
          setField={setField}
          getField={getField}
          createSessionLocal={createSessionLocal}
          showT={showT}
          bs={bs}
          bp={bp}
          inp={inp}
        />
      )}

      {modal === "convite-inventariante" && (
        <Overlay
          isMobile={isMob}
          onClose={() => {
            setModal(null);
            setInvConviteLink("");
            setInvConviteExp("");
          }}
        >
          <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700 }}>Convidar colega para inventário</h2>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>
            Envie o link para a pessoa se cadastrar. Após o cadastro, aprove em Inventariantes (admin) e ela poderá inventariar na mesma unidade com você.
          </p>
          {gerandoInvConvite ? (
            <p style={{ margin: 0, fontSize: 13, color: "#64748b", textAlign: "center", padding: 20 }}>Gerando link…</p>
          ) : invConviteLink ? (
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#15803d" }}>Link válido por 7 dias</p>
              {invConviteExp && (
                <p style={{ margin: "0 0 8px", fontSize: 11, color: "#64748b" }}>
                  Até {new Date(invConviteExp).toLocaleDateString("pt-BR")}
                </p>
              )}
              <p style={{ margin: 0, fontSize: 11, color: "#0f172a", wordBreak: "break-all", lineHeight: 1.4 }}>{invConviteLink}</p>
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                setModal(null);
                setInvConviteLink("");
              }}
              style={{ ...bs, flex: 1 }}
            >
              Fechar
            </button>
            {invConviteLink && (
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(invConviteLink);
                    showT("Link copiado");
                  } catch {
                    showT("Copie o link manualmente");
                  }
                }}
                style={{ ...bp, flex: 1 }}
              >
                Copiar link
              </button>
            )}
          </div>
        </Overlay>
      )}

      {modal === "finalizar" && (
        <FinalizarModal
          isMob={isMob}
          setModal={setModal}
          inventario={inventario}
          getField={getField}
          setField={setField}
          finalizarComCoordenadora={finalizarComCoordenadora}
          busy={busy}
          bs={bs}
          bp={bp}
          inp={inp}
        />
      )}

      {modal === "qrcode-resultado" && qrCodeUrl && (
        <Overlay
          isMobile={isMob}
          onClose={() => {
            setModal(null);
            setQrCodeUrl(null);
            setCoordRegistroLink("");
          }}
        >
          <div style={{ textAlign: "center" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700 }}>Acesso da coordenadora</h2>
            <p style={{ color: "#64748b", margin: "0 0 12px", fontSize: 13 }}>
              {getField("coordNome")} · matr. {getField("coordMatricula")}
            </p>
            <img src={qrCodeUrl} alt="QR Code" style={{ width: 240, maxWidth: "100%", height: "auto", margin: "0 auto", border: "1px solid #e2e8f0", borderRadius: 8 }} />
            {coordRegistroLink && (
              <div style={{ marginTop: 12, textAlign: "left", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10 }}>
                <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#475569" }}>Link de cadastro (válido por 7 dias)</p>
                <p style={{ margin: 0, fontSize: 11, color: "#0f172a", wordBreak: "break-all", lineHeight: 1.4 }}>{coordRegistroLink}</p>
              </div>
            )}
            <p style={{ color: "#64748b", margin: "12px 0 0", fontSize: 12, lineHeight: 1.45, textAlign: "left" }}>
              1. Envie o QR Code ou o link para a coordenadora.<br />
              2. Ela abre no celular, cria a senha e aguarda aprovação.<br />
              3. Aprove o cadastro na aba Coordenadores.<br />
              4. Depois ela entra em /coord com e-mail e senha.
            </p>
            <div style={{ display: "flex", gap: 9, marginTop: 16, flexDirection: isMob ? "column" : "row" }}>
              {coordRegistroLink && (
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(coordRegistroLink);
                      showT("Link copiado");
                    } catch {
                      showT("Copie o link manualmente");
                    }
                  }}
                  style={{ ...bs, flex: 1 }}
                >
                  Copiar link
                </button>
              )}
              <button
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = qrCodeUrl;
                  a.download = `qr_coord_${Date.now()}.png`;
                  a.target = "_blank";
                  a.rel = "noopener";
                  a.click();
                }}
                style={{ ...bs, flex: 1 }}
              >
                Baixar QR
              </button>
              <button
                onClick={() => {
                  setModal(null);
                  setQrCodeUrl(null);
                  setCoordRegistroLink("");
                  inventario.clearAtivas();
                }}
                style={{ ...bp, flex: 1 }}
              >
                Concluir
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {modal === "semTombo" && (
        <SemTomboModal
          isMob={isMob}
          revokeBlobUrls={revokeBlobUrls}
          formRef={formRef}
          setModal={setModal}
          bumpFt={bumpFt}
          getField={getField}
          setField={setField}
          sessionLocais={sessionLocais}
          openCamera={openCamera}
          inventario={inventario}
          sugestoes={sugestoes}
          getSemTomboPendentes={getSemTomboPendentes}
          toggleStPending={toggleStPending}
          getItemCode={getItemCode}
          addSemTomboPendentes={addSemTomboPendentes}
          addSemTomboItem={addSemTomboItem}
          bs={bs}
          bp={bp}
          inp={inp}
          ft={ft}
        />
      )}

      {modal === "ajusteLink" && formRef.current.ajusteStItem && (
        <AjusteLinkModal
          isMob={isMob}
          setModal={setModal}
          formRef={formRef}
          getField={getField}
          setField={setField}
          bumpFt={bumpFt}
          scopeAllItens={scopeAllItens}
          isSemTomboItem={isSemTomboItem}
          found={found}
          rankTombosForAjuste={rankTombosForAjuste}
          linkSemTomboToTombo={linkSemTomboToTombo}
          bs={bs}
          bp={bp}
          inp={inp}
          ft={ft}
        />
      )}

      {modal === "cancelar-inventario" && (
        <Overlay isMobile={isMob} onClose={() => setModal(null)}>
          <div>
            <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#b91c1c" }}>Encerrar sessão de inventário?</h2>
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#991b1b", lineHeight: 1.55 }}>
                Isso remove as unidades selecionadas desta sessão e oculta os locais criados nela. Os itens já inventariados <strong>permanecem salvos</strong> no sistema.
              </p>
            </div>
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 16px" }}>
              {inventario.unidadesAtivas.length} unidade{inventario.unidadesAtivas.length > 1 ? "s" : ""} · {inventario.totalFound} item{inventario.totalFound !== 1 ? "ns" : ""} registrado{inventario.totalFound !== 1 ? "s" : ""}
            </p>
            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={() => setModal(null)} style={{ ...bp, flex: 2 }}>
                Voltar ao inventário
              </button>
              <button
                onClick={() => {
                  inventario.clearAtivas();
                  inventario.setInvSubTab("inventariar");
                  setModal(null);
                  showT("Sessão encerrada");
                }}
                style={{ ...bs, flex: 1, color: "#b91c1c", borderColor: "#fca5a5" }}
              >
                Encerrar sessão
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {imgViewSrc && <ImageOverlay src={imgViewSrc} onClose={() => setImgViewSrc(null)} />}

      {busy && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(241,245,249,.72)", zIndex: 600, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }}>
          <div style={{ width: 40, height: 40, border: "4px solid #e2e8f0", borderTopColor: "#1351B4", borderRadius: "50%", animation: "sp .8s linear infinite" }} />
          <p style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textAlign: "center" }}>Processando...</p>
        </div>
      )}

      <ToastNotification message={toast} isMobile={isMob} />
    </div>
  );
}

