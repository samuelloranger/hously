import { useTranslation } from "react-i18next";
import { useDashboardStats } from "@/pages/_component/useDashboardStats";
import { TileCard } from "@/pages/_component/tiles/TileCard";

export function ChoresTodayTile() {
  const { t } = useTranslation("common");
  const { data } = useDashboardStats();
  const count = data?.stats.chores_count ?? 0;
  return (
    <TileCard label={t("dashboard.tiles.choresLabel")} to="/chores">
      <span className="font-display text-2xl font-semibold text-neutral-50 tabular-nums">
        {count}
      </span>
      <span className="ml-1.5 text-sm text-neutral-400">
        {t("dashboard.tiles.choresPending", { count })}
      </span>
    </TileCard>
  );
}
