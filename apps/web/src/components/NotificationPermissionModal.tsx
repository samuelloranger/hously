import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

interface NotificationPermissionModalProps {
  isOpen: boolean;
  onAllow: () => void;
  onDismiss: () => void;
}

export function NotificationPermissionModal({
  isOpen,
  onAllow,
  onDismiss,
}: NotificationPermissionModalProps) {
  const { t } = useTranslation("common");
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Small delay for animation
      setTimeout(() => setIsVisible(true), 50);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-modal-title"
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${
          isVisible ? "opacity-50" : "opacity-0"
        }`}
        onClick={onDismiss}
      />

      {/* Modal */}
      <div
        className={`relative bg-neutral-50 dark:bg-neutral-800 rounded-lg shadow-xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-6 transform transition-all duration-300 border border-neutral-200 dark:border-neutral-700 ${
          isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <div className="flex items-start mb-4">
          <div className="flex-shrink-0 text-3xl">🔔</div>
          <div className="ml-4 flex-1">
            <h3
              id="notification-modal-title"
              className="text-lg font-semibold text-neutral-900 dark:text-white mb-2"
            >
              {t("notifications.modal.title")}
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              {t("notifications.modal.description")}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <button
            onClick={onAllow}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium"
          >
            {t("notifications.modal.allow")}
          </button>
          <button
            onClick={onDismiss}
            className="flex-1 px-4 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-md hover:bg-neutral-300 dark:hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 transition-colors font-medium"
          >
            {t("notifications.modal.dismiss")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
