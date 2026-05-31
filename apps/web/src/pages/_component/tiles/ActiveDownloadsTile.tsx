import { useTranslation } from "react-i18next";
import { ArrowDown } from "lucide-react";
import { useDownloadsSpeed } from "@/pages/_component/useDownloadsSpeed";
import { formatSpeed } from "@/lib/utils/format";
import { TileCard } from "@/pages/_component/tiles/TileCard";

export function ActiveDownloadsTile() {
  const { t } = useTranslation("common");
  const { data } = useDownloadsSpeed();
  const dlSpeed = data?.dl_speed ?? 0;

  return (
    <TileCard
      label={t("dashboard.tiles.downloadsLabel")}
      to="/library/downloads"
    >
      <span className="flex items-baseline gap-1.5">
        <ArrowDown size={16} className="self-center text-primary-400" />
        <span className="font-display text-2xl font-semibold text-neutral-50 tabular-nums">
          {formatSpeed(dlSpeed)}
        </span>
      </span>
      <span className="mt-0.5 text-xs text-neutral-400">
        {data?.connected
          ? t("dashboard.tiles.downloadsActive")
          : t("dashboard.tiles.downloadsIdle")}
      </span>
    </TileCard>
  );
}
