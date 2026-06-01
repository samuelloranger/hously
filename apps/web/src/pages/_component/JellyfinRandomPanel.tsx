import { useTranslation } from "react-i18next";
import { Shuffle, Tv2, ExternalLink } from "lucide-react";
import { useJellyfinRandom } from "@/pages/_component/useJellyfinRandom";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { WidgetHeader, WidgetShell } from "@/pages/_component/widgetPrimitives";

function Skeleton() {
  const { t } = useTranslation("common");
  return (
    <WidgetShell>
      <WidgetHeader icon={Tv2} title={t("dashboard.jellyfinRandom.title")} />
      <div className="p-4 flex gap-4">
        <div className="w-20 h-28 rounded-lg bg-neutral-800 animate-pulse shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 w-3/4 rounded bg-neutral-800 animate-pulse" />
          <div className="h-3 w-1/4 rounded bg-neutral-800 animate-pulse" />
          <div className="h-3 w-full rounded bg-neutral-800 animate-pulse" />
          <div className="h-3 w-5/6 rounded bg-neutral-800 animate-pulse" />
        </div>
      </div>
    </WidgetShell>
  );
}

export function JellyfinRandomPanel() {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const { data, isPending, isFetching } = useJellyfinRandom();

  if (isPending) return <Skeleton />;
  if (!data?.enabled || !data.item) return null;

  const { item } = data;

  const shuffle = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.dashboard.jellyfinRandom(),
    });
  };

  return (
    <WidgetShell>
      <WidgetHeader
        icon={Tv2}
        title={t("dashboard.jellyfinRandom.title")}
        right={
          <button
            onClick={shuffle}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-primary-400 transition-colors disabled:opacity-40"
            title={t("dashboard.jellyfinRandom.shuffle")}
          >
            <Shuffle size={13} className={isFetching ? "animate-spin" : ""} />
            {t("dashboard.jellyfinRandom.rollAgain")}
          </button>
        }
      />

      <div className="p-4 flex gap-4">
        {item.poster_url ? (
          <img
            src={item.poster_url}
            alt={item.title}
            className="w-20 h-28 object-cover rounded-lg shrink-0 bg-neutral-800 ring-1 ring-neutral-800 shadow-lg shadow-black/30"
          />
        ) : (
          <div className="w-20 h-28 rounded-lg bg-neutral-800 shrink-0 flex items-center justify-center">
            <Tv2 size={24} className="text-neutral-400" />
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-base font-display font-semibold text-neutral-100 leading-tight line-clamp-2">
              {item.title}
            </p>
            {item.item_url && (
              <a
                href={item.item_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-neutral-400 hover:text-primary-400 transition-colors mt-0.5"
              >
                <ExternalLink size={13} />
              </a>
            )}
          </div>
          {item.year && <p className="text-xs text-neutral-500">{item.year}</p>}
          {(item.overview ?? item.subtitle) && (
            <p className="text-xs text-neutral-400 line-clamp-4 leading-relaxed">
              {item.overview ?? item.subtitle}
            </p>
          )}
        </div>
      </div>
    </WidgetShell>
  );
}
