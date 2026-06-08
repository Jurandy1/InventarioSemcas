import { useCallback, useEffect, useState } from "react";
import { offlineManager } from "../services/features.js";
import { createVisibilityAwarePoller } from "../utils/mobilePerf.js";

export function useOfflineQueue() {
  const [queueStatus, setQueueStatus] = useState(() => offlineManager.getQueueStatus());

  const updateQueueStatus = useCallback(() => {
    const next = offlineManager.getQueueStatus();
    setQueueStatus((prev) => {
      if (
        prev &&
        prev.total === next.total &&
        prev.pending === next.pending &&
        prev.failed === next.failed &&
        prev.lastError === next.lastError &&
        prev.isOnline === next.isOnline &&
        prev.isSyncing === next.isSyncing
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    updateQueueStatus();
    window.addEventListener("online", updateQueueStatus);
    window.addEventListener("offline", updateQueueStatus);
    const stopPoller = createVisibilityAwarePoller(updateQueueStatus, {
      activeMs: 15000,
      hiddenMs: 45000,
      runImmediately: false,
    });
    return () => {
      stopPoller();
      window.removeEventListener("online", updateQueueStatus);
      window.removeEventListener("offline", updateQueueStatus);
    };
  }, [updateQueueStatus]);

  return { queueStatus, updateQueueStatus };
}

