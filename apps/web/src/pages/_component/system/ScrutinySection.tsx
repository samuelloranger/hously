import { useTranslation } from "react-i18next";
import { HardDrive } from "lucide-react";
import { useDashboardScrutinySummary } from "@/pages/_component/useDashboardSystem";
import { SectionTitle, MetricRow } from "./shared";

export function ScrutinySection() {
  const { t } = useTranslation("common");
  const { data } = useDashboardScrutinySummary();
  if (!data?.enabled || !data?.connected) return null;
  const s = data.summary;

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-1 h-4 rounded-full bg-rose-500 shrink-0" />
        <HardDrive
          className="w-4 h-4 shrink-0 text-neutral-400"
          strokeWidth={2}
        />
        <SectionTitle>{t("dashboard.scrutiny.title")}</SectionTitle>
      </div>
      <MetricRow
        label={t("dashboard.home.scrutinyDrivesLabel")}
        value={t("dashboard.home.scrutinyDrivesOk", {
          healthy: s.healthy_drives,
          total: s.total_drives,
        })}
        sub={
          s.warning_drives > 0
            ? t("dashboard.home.scrutinyWarnings", { count: s.warning_drives })
            : undefined
        }
        status={s.warning_drives > 0 ? "warn" : "ok"}
      />
      {s.avg_temp_c != null && (
        <MetricRow
          label={t("dashboard.home.avgTemp")}
          value={`${s.avg_temp_c.toFixed(0)}°C`}
          sub={
            s.hottest_temp_c != null
              ? t("dashboard.home.maxTemp", {
                  value: s.hottest_temp_c.toFixed(0),
                })
              : undefined
          }
          status={
            s.hottest_temp_c != null && s.hottest_temp_c > 55 ? "warn" : "ok"
          }
        />
      )}
    </div>
  );
}
