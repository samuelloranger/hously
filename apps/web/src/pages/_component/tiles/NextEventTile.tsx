import { useTranslation } from "react-i18next";
import { CalendarClock } from "lucide-react";
import { useDashboardUpcoming } from "@/pages/_component/useDashboardUpcoming";
import {
  formatRelativeTime,
  resolveDateFnsLocale,
} from "@/lib/utils/relativeTime";
import { TileCard } from "@/pages/_component/tiles/TileCard";

export function NextEventTile() {
  const { t, i18n } = useTranslation("common");
  const locale = resolveDateFnsLocale(i18n.language);
  const { data } = useDashboardUpcoming();
  const item = data?.items[0] ?? null;
  const when = item ? formatRelativeTime(item.release_date, { locale }) : null;

  return (
    <TileCard label={t("dashboard.tiles.nextEventLabel")} to="/calendar">
      {item ? (
        <div className="flex items-center gap-2">
          <CalendarClock size={16} className="shrink-0 text-primary-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-neutral-50">
              {item.title}
            </p>
            {when ? (
              <p className="truncate text-xs text-neutral-400">{when}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <span className="text-sm text-neutral-400">
          {t("dashboard.tiles.nextEventEmpty")}
        </span>
      )}
    </TileCard>
  );
}
