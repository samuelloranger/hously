import { useEffect, useState } from "react";
import { usePWA } from "../hooks/usePWA";

export function PWAInstallBanner() {
  const {
    isIOS,
    showIOSBanner,
    showPWABanner,
    installPWA,
    dismissIOSBanner,
    dismissPWABanner,
  } = usePWA();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (showIOSBanner || showPWABanner) {
      // Small delay for animation
      setTimeout(() => setIsVisible(true), 1000);
    } else {
      setIsVisible(false);
    }
  }, [showIOSBanner, showPWABanner]);

  if (!showIOSBanner && !showPWABanner) {
    return null;
  }

  if (isIOS && showIOSBanner) {
    return (
      <div
        className={`fixed bottom-4 left-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50 transform transition-transform duration-300 ${
          isVisible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-sm">Install Hously App</h3>
            <p className="text-xs mt-1 opacity-90">
              Tap <span className="text-blue-200">📤</span> then "Add to Home
              Screen" for the best experience
            </p>
          </div>
          <button
            onClick={dismissIOSBanner}
            className="ml-2 text-blue-200 hover:text-white"
            aria-label="Dismiss"
          >
            <span>✕</span>
          </button>
        </div>
      </div>
    );
  }

  if (!isIOS && showPWABanner) {
    return (
      <div
        className={`fixed bottom-4 left-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50 transform transition-transform duration-300 ${
          isVisible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-sm">Install Hously App</h3>
            <p className="text-xs mt-1 opacity-90">
              {"Get the full app experience"}
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={installPWA}
              className="bg-white text-blue-600 px-3 py-1 rounded text-xs font-medium hover:bg-blue-50"
            >
              Install
            </button>
            <button
              onClick={dismissPWABanner}
              className="text-blue-200 hover:text-white"
              aria-label="Dismiss"
            >
              <span>✕</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
