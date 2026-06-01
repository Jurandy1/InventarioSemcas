import { useCallback, useEffect, useState } from "react";
import { offlineManager } from "../services/features.js";

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
    const queueTimer = setInterval(updateQueueStatus, 10000);
    return () => {
      clearInterval(queueTimer);
      window.removeEventListener("online", updateQueueStatus);
      window.removeEventListener("offline", updateQueueStatus);
    };
  }, [updateQueueStatus]);

  return { queueStatus, updateQueueStatus };
}

