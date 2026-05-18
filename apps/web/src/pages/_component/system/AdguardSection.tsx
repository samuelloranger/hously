import { useTranslation } from "react-i18next";
import { Shield } from "lucide-react";
import { useDashboardAdguardSummary } from "@/pages/_component/useDashboardSystem";
import { useSetAdguardProtection } from "@/pages/settings/useSetAdguardProtection";
import { useAuth } from "@/lib/auth/useAuth";
import { SectionTitle, MetricRow } from "./shared";

export function AdguardSection() {
  const { t } = useTranslation("common");
  const { data } = useDashboardAdguardSummary();
  const setProtection = useSetAdguardProtection();
  const { user } = useAuth();

  if (!data?.enabled || !data?.connected) return null;
  const s = data.summary;
  const isAdmin = Boolean(user?.is_admin);
  const protOn = data.protection_enabled;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-4 rounded-full bg-amber-500 shrink-0" />
          <Shield
            className="w-4 h-4 shrink-0 text-zinc-500 dark:text-zinc-400"
            strokeWidth={2}
          />
          <SectionTitle>{t("dashboard.home.adguardHeading")}</SectionTitle>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setProtection.mutate({ enabled: !protOn })}
            disabled={setProtection.isPending}
            className={`text-xs font-semibold rounded-full px-3 py-1 transition-colors border ${
              protOn
                ? "border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                : "border-rose-200 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30"
            } disabled:opacity-50`}
          >
            {setProtection.isPending
              ? t("dashboard.home.protectionPending")
              : protOn
                ? t("dashboard.home.protectionOn")
                : t("dashboard.home.protectionOff")}
          </button>
        )}
      </div>
      <MetricRow
        label={t("dashboard.adguard.blocked")}
        value={s.blocked_ratio != null ? `${s.blocked_ratio.toFixed(1)}%` : "–"}
        sub={t("dashboard.home.queriesOf", {
          blocked: s.blocked_queries.toLocaleString(),
          total: s.dns_queries.toLocaleString(),
        })}
        status={protOn ? "ok" : "warn"}
      />
      {s.avg_processing_time_ms != null && (
        <MetricRow
          label={t("dashboard.adguard.avgTime")}
          value={`${s.avg_processing_time_ms.toFixed(1)} ms`}
        />
      )}
    </div>
  );
}
