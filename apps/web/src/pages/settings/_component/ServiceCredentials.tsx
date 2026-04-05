import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import type { ExternalNotificationService } from "@hously/shared/types";
interface ServiceCredentialsProps {
  service: ExternalNotificationService;
  isLoading: boolean;
  onRegenerateToken: () => void;
}

export function ServiceCredentials({
  service,
  isLoading,
  onRegenerateToken,
}: ServiceCredentialsProps) {
  const { t } = useTranslation("common");
  const [copied, setCopied] = useState<"token" | "url" | null>(null);

  const copyToClipboard = (
    text: string,
    field: "token" | "url",
    label: string,
  ) => {
    navigator.clipboard.writeText(text).then(
      () => {
        toast.success(t("settings.externalNotifications.copied", { label }));
        setCopied(field);
        setTimeout(() => setCopied(null), 1500);
      },
      () => {
        toast.error(t("settings.externalNotifications.copyError"));
      },
    );
  };

  if (!service.enabled || !service.token) {
    return null;
  }

  return (
    <div className="space-y-3 pb-4 border-b border-neutral-200 dark:border-neutral-600">
      {/* Token */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t("settings.externalNotifications.token")}
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={service.token}
            readOnly
            className="flex-1 px-4 py-2 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 font-mono text-sm"
          />
          <button
            onClick={() =>
              copyToClipboard(
                service.token!,
                "token",
                t("settings.externalNotifications.token"),
              )
            }
            className="flex items-center gap-1.5 px-4 py-2 bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-500 transition-colors text-sm font-medium min-w-[80px] justify-center"
          >
            {copied === "token" ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                <span className="text-green-600 dark:text-green-400">
                  {t("common.copied")}
                </span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                {t("settings.externalNotifications.copy")}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Webhook URL */}
      {service.webhook_url && (
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t("settings.externalNotifications.webhookUrl")}
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={service.webhook_url}
              readOnly
              className="flex-1 px-4 py-2 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 font-mono text-sm"
            />
            <button
              onClick={() =>
                copyToClipboard(
                  service.webhook_url!,
                  "url",
                  t("settings.externalNotifications.webhookUrl"),
                )
              }
              className="flex items-center gap-1.5 px-4 py-2 bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-500 transition-colors text-sm font-medium min-w-[80px] justify-center"
            >
              {copied === "url" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                  <span className="text-green-600 dark:text-green-400">
                    {t("common.copied")}
                  </span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  {t("settings.externalNotifications.copy")}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Regenerate Token Button */}
      <div>
        <button
          onClick={onRegenerateToken}
          disabled={isLoading}
          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          {t("settings.externalNotifications.regenerateToken")}
        </button>
      </div>
    </div>
  );
}
