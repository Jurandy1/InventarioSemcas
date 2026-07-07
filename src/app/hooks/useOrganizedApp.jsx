import { useEffect } from "react";
import { clearChunkReloadFlag } from "../../utils/lazyWithRetry.js";
import { useAppState } from "./useAppState.js";
import { useAppData } from "./useAppData.js";
import { useAppSync } from "./useAppSync.jsx";
import { useAppCamera } from "./useAppCamera.js";
import { useAppItemActions } from "./useAppItemActions.js";
import { revokeBlobUrls } from "../helpers/appHelpers.js";

export function useOrganizedApp({ firebaseOk, isProd }) {
  useEffect(() => {
    clearChunkReloadFlag();
  }, []);

  const state = useAppState();
  const data = useAppData({ firebaseOk, state });
  const { renderOfflineStatus } = useAppSync({ state, data });
  const camera = useAppCamera({ state, data });
  const actions = useAppItemActions({ state, data });

  return {
    ...state,
    ...data,
    ...camera,
    ...actions,
    firebaseOk,
    isProd,
    renderOfflineStatus,
    revokeBlobUrls,
  };
}
