import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { useLibraryAttention } from "@/features/medias/hooks/useLibraryAttention";
import { TileCard } from "@/pages/_component/tiles/TileCard";

export function LibraryAlertsTile() {
  const { t } = useTranslation("common");
  const { data } = useLibraryAttention();
  const count = data?.items.length ?? 0;

  return (
    <TileCard label={t("dashboard.tiles.libraryAlertsLabel")} to="/library">
      <span className="flex items-baseline gap-1.5">
        <AlertTriangle
          size={16}
          className={
            count > 0
              ? "self-center text-amber-500"
              : "self-center text-neutral-500"
          }
        />
        <span className="font-display text-2xl font-semibold text-neutral-50 tabular-nums">
          {count}
        </span>
        <span className="text-sm text-neutral-400">
          {t("dashboard.tiles.libraryAlertsCount", { count })}
        </span>
      </span>
    </TileCard>
  );
}
