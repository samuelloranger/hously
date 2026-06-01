import { useTranslation } from "react-i18next";
import { Flame } from "lucide-react";
import { useDashboardStats } from "@/pages/_component/useDashboardStats";
import { TileCard } from "@/pages/_component/tiles/TileCard";

export function HabitStreakTile() {
  const { t } = useTranslation("common");
  const { data } = useDashboardStats();
  const streak = data?.stats.habits_streak ?? 0;
  return (
    <TileCard label={t("dashboard.tiles.streakLabel")} to="/habits">
      <span className="flex items-baseline gap-1.5">
        <Flame size={18} className="self-center text-primary-400" />
        <span className="font-display text-2xl font-semibold text-neutral-50 tabular-nums">
          {streak}
        </span>
        <span className="text-sm text-neutral-400">
          {t("dashboard.tiles.streakDays", { count: streak })}
        </span>
      </span>
    </TileCard>
  );
}
