import { useTranslation } from "react-i18next";
import { Cpu } from "lucide-react";
import { useDashboardSystemSummary } from "@/pages/_component/useDashboardSystem";
import { TileCard } from "@/pages/_component/tiles/TileCard";

export function SystemTile() {
  const { t } = useTranslation("common");
  const { data } = useDashboardSystemSummary();
  const cpu = data?.summary.cpu_percent;

  return (
    <TileCard label={t("dashboard.tiles.systemLabel")}>
      <span className="flex items-baseline gap-1.5">
        <Cpu size={16} className="self-center text-primary-400" />
        <span className="font-display text-2xl font-semibold text-neutral-50 tabular-nums">
          {cpu != null ? `${Math.round(cpu)}%` : "—"}
        </span>
        <span className="text-sm text-neutral-400">
          {t("dashboard.tiles.systemCpu")}
        </span>
      </span>
    </TileCard>
  );
}
