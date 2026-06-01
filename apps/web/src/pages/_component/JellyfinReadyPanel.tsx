import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Film, Play, PlayCircle } from "lucide-react";
import { useDashboardJellyfinLatestInfinite } from "@/pages/_component/useDashboardJellyfin";
import {
  formatRelativeTime,
  resolveDateFnsLocale,
} from "@/lib/utils/relativeTime";
import { WidgetHeader, WidgetShell } from "@/pages/_component/widgetPrimitives";

function Skeleton({ title }: { title: string }) {
  return (
    <WidgetShell>
      <WidgetHeader icon={PlayCircle} title={title} />
      <div className="p-4 flex gap-4">
        <div className="w-20 h-28 rounded-lg bg-neutral-800 animate-pulse shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 w-3/4 rounded bg-neutral-800 animate-pulse" />
          <div className="h-3 w-1/3 rounded bg-neutral-800 animate-pulse" />
          <div className="h-7 w-24 rounded-lg bg-neutral-800 animate-pulse mt-1" />
        </div>
      </div>
    </WidgetShell>
  );
}

export function JellyfinReadyPanel() {
  const { t, i18n } = useTranslation("common");
  const locale = resolveDateFnsLocale(i18n.language);
  const { data, isPending } = useDashboardJellyfinLatestInfinite(10);

  const title = t("dashboard.tiles.latestMediaReady");

  if (isPending) return <Skeleton title={title} />;

  const enabled = data?.pages[0]?.enabled ?? false;
  const item = data?.pages[0]?.items[0] ?? null;
  if (!enabled || !item) return null;

  const when = item.added_at
    ? formatRelativeTime(item.added_at, { locale })
    : null;
  const subtitle = [item.subtitle, when].filter(Boolean).join(" · ");

  const watchInner = (
    <>
      <Play size={13} className="fill-current" />
      {t("dashboard.tiles.latestMediaWatch")}
    </>
  );
  const watchClass =
    "inline-flex items-center gap-1.5 rounded-lg bg-primary-400 px-3 py-1.5 text-xs font-bold text-neutral-950 hover:bg-primary-300 transition-colors";

  return (
    <WidgetShell>
      <WidgetHeader icon={PlayCircle} title={title} />

      <div className="p-4 flex gap-4">
        {item.poster_url ? (
          <img
            src={item.poster_url}
            alt={item.title}
            loading="lazy"
            className="w-20 h-28 object-cover rounded-lg shrink-0 bg-neutral-800 ring-1 ring-neutral-800 shadow-lg shadow-black/30"
          />
        ) : (
          <div className="w-20 h-28 rounded-lg bg-neutral-800 shrink-0 flex items-center justify-center">
            <Film size={24} className="text-neutral-400" />
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-base font-display font-semibold text-neutral-100 leading-tight line-clamp-2">
            {item.title}
          </p>
          {subtitle && (
            <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
              {subtitle}
            </p>
          )}
          <div className="pt-1">
            {item.item_url ? (
              <a
                href={item.item_url}
                target="_blank"
                rel="noreferrer"
                className={watchClass}
              >
                {watchInner}
              </a>
            ) : (
              <Link to="/library" className={watchClass}>
                {watchInner}
              </Link>
            )}
          </div>
        </div>
      </div>
    </WidgetShell>
  );
}
