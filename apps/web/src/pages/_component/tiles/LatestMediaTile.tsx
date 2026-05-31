import { useTranslation } from "react-i18next";
import { Film } from "lucide-react";
import { useDashboardJellyfinLatestInfinite } from "@/pages/_component/useDashboardJellyfin";
import { TileCard } from "@/pages/_component/tiles/TileCard";

export function LatestMediaTile() {
  const { t } = useTranslation("common");
  const { data } = useDashboardJellyfinLatestInfinite(10);
  const item = data?.pages[0]?.items[0] ?? null;

  return (
    <TileCard label={t("dashboard.tiles.latestMediaLabel")} to="/library">
      {item ? (
        <div className="flex items-center gap-2.5">
          {item.poster_url ? (
            <img
              src={item.poster_url}
              alt=""
              className="h-12 w-8 shrink-0 rounded object-cover"
            />
          ) : (
            <div className="flex h-12 w-8 shrink-0 items-center justify-center rounded bg-neutral-700">
              <Film size={14} className="text-neutral-500" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-neutral-50">
              {item.title}
            </p>
            {item.subtitle ? (
              <p className="truncate text-xs text-neutral-400">
                {item.subtitle}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <span className="text-sm text-neutral-400">
          {t("dashboard.tiles.latestMediaEmpty")}
        </span>
      )}
    </TileCard>
  );
}
