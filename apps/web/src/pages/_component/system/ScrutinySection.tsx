import { useTranslation } from "react-i18next";
import { HardDrive } from "lucide-react";
import { useDashboardScrutinySummary } from "@/pages/_component/useDashboardSystem";
import { ModuleEyebrow, MetricRow } from "./shared";

export function ScrutinySection() {
  const { t } = useTranslation("common");
  const { data } = useDashboardScrutinySummary();
  if (!data?.enabled || !data?.connected) return null;
  const s = data.summary;

  return (
    <div className="px-4 py-4 border-t border-neutral-800 first:border-t-0">
      <ModuleEyebrow icon={HardDrive} title={t("dashboard.scrutiny.title")} />
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
