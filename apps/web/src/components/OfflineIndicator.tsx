import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getNetworkStatus,
  onOnline,
  onOffline,
} from "../lib/offline/networkStatus";
import { getPendingMutationCount } from "../lib/offline/mutationQueue";
import { WifiOff, Wifi, Loader2 } from "lucide-react";

export function OfflineIndicator() {
  const { t } = useTranslation("common");
  const [isOnline, setIsOnline] = useState(getNetworkStatus());
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Update status on mount
    setIsOnline(getNetworkStatus());
    getPendingMutationCount().then(setPendingCount);

    // Subscribe to network status changes
    const unsubscribeOnline = onOnline(() => {
      setIsOnline(true);
      // Refresh pending count when back online
      getPendingMutationCount().then(setPendingCount);
    });

    const unsubscribeOffline = onOffline(() => {
      setIsOnline(false);
    });

    // Poll for pending count updates every 5 seconds
    const interval = setInterval(() => {
      getPendingMutationCount().then(setPendingCount);
    }, 5000);

    return () => {
      unsubscribeOnline();
      unsubscribeOffline();
      clearInterval(interval);
    };
  }, []);

  // Don't show anything if online and no pending mutations
  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${
        isOnline ? "translate-y-0 opacity-100" : "translate-y-0 opacity-100"
      }`}
    >
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg ${
          isOnline ? "bg-blue-500 text-white" : "bg-red-500 text-white"
        }`}
      >
        {isOnline ? (
          <>
            {pendingCount > 0 ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">
                  {t("offline.syncing", { count: pendingCount })}
                </span>
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {t("offline.online")}
                </span>
              </>
            )}
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" />
            <span className="text-sm font-medium">{t("offline.offline")}</span>
            {pendingCount > 0 && (
              <span className="text-xs opacity-90 ml-1">
                ({pendingCount} {t("offline.pending")})
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
