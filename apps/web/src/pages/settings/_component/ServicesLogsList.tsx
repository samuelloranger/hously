import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useExternalNotificationLogs } from "@/pages/settings/useExternalNotifications";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function ServicesLogsList() {
  const { t } = useTranslation("common");
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

  const {
    data: logsData,
    isLoading,
    refetch,
    isFetching,
  } = useExternalNotificationLogs();

  const logs = logsData?.logs || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "failure":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      default:
        return "bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const parsePayload = (payload: string) => {
    try {
      return JSON.parse(payload);
    } catch {
      return payload;
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
        {t("common.loading")}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
        {t("settings.externalNotifications.logs.noLogs")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          {t("settings.externalNotifications.logs.refetch")}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
          <thead className="bg-neutral-50 dark:bg-neutral-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                {t("settings.externalNotifications.logs.service")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                {t("settings.externalNotifications.logs.eventType")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                {t("settings.externalNotifications.logs.status")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                {t("settings.externalNotifications.logs.createdAt")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider w-32">
                {t("settings.externalNotifications.logs.payload")}
              </th>
            </tr>
          </thead>
          {logs.map((log) => {
            const payload = parsePayload(log.payload);
            const isOpen = expandedLogs.has(log.id);
            return (
              <Collapsible
                key={log.id}
                open={isOpen}
                onOpenChange={(open) => {
                  if (open) {
                    setExpandedLogs((prev) => new Set(prev).add(log.id));
                  } else {
                    setExpandedLogs((prev) => {
                      const newSet = new Set(prev);
                      newSet.delete(log.id);
                      return newSet;
                    });
                  }
                }}
                asChild
              >
                <tbody className="bg-white dark:bg-neutral-900 dark:divide-neutral-700">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {log.service_name || `Service #${log.service_id}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500 dark:text-neutral-400">
                      {log.event_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          log.status,
                        )}`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500 dark:text-neutral-400">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline font-medium whitespace-nowrap min-w-[160px]">
                          {isOpen
                            ? t(
                                "settings.externalNotifications.logs.hidePayload",
                              )
                            : t(
                                "settings.externalNotifications.logs.viewPayload",
                              )}
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform duration-200",
                              isOpen && "rotate-180",
                            )}
                          />
                        </button>
                      </CollapsibleTrigger>
                    </td>
                  </tr>
                  <tr className="bg-neutral-50 dark:bg-neutral-800 bg-neutral-100 dark:bg-neutral-900 ">
                    <td colSpan={5} className="px-6 py-0">
                      <CollapsibleContent>
                        <div className="bg-white dark:bg-neutral-800 p-4 mb-4 rounded-lg max-w-full overflow-hidden">
                          <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                            {t("settings.externalNotifications.logs.payload")}
                          </h4>
                          <pre className="text-xs text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap break-words break-all overflow-wrap-anywhere max-w-full overflow-x-auto">
                            {JSON.stringify(payload, null, 2)}
                          </pre>
                        </div>
                      </CollapsibleContent>
                    </td>
                  </tr>
                </tbody>
              </Collapsible>
            );
          })}
        </table>
      </div>
    </div>
  );
}
