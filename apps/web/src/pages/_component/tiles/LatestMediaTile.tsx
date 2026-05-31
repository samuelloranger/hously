import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Film, Play } from "lucide-react";
import { useDashboardJellyfinLatestInfinite } from "@/pages/_component/useDashboardJellyfin";
import {
  formatRelativeTime,
  resolveDateFnsLocale,
} from "@/lib/utils/relativeTime";

// Full-width "feature" card matching the v3 mockup: warm gradient, poster,
// apricot "ready" label, Fraunces title, subtitle, apricot Watch button.
// Spans the whole smart-tile strip row (the other tiles flow below it).
const CARD_CLASS =
  "col-span-2 flex items-center gap-4 rounded-2xl border border-[#3a2f27] bg-gradient-to-r from-[#2a2220] to-[#34281f] p-[18px] transition-colors hover:border-primary-400/50 min-[700px]:col-span-4";

const POSTER_CLASS =
  "h-[92px] w-16 shrink-0 rounded-[9px] object-cover shadow-[0_6px_16px_rgba(0,0,0,0.35)]";

const POSTER_FALLBACK_CLASS =
  "flex h-[92px] w-16 shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#6a4632] to-[#cf6a4e] shadow-[0_6px_16px_rgba(0,0,0,0.35)]";

const LABEL_CLASS =
  "text-[11px] font-bold uppercase tracking-[0.08em] text-[#a8896f]";

export function LatestMediaTile() {
  const { t, i18n } = useTranslation("common");
  const locale = resolveDateFnsLocale(i18n.language);
  const { data } = useDashboardJellyfinLatestInfinite(10);
  const item = data?.pages[0]?.items[0] ?? null;

  if (!item) {
    return (
      <div className={CARD_CLASS}>
        <div className={POSTER_FALLBACK_CLASS}>
          <Film size={20} className="text-neutral-950/70" />
        </div>
        <div className="min-w-0">
          <p className={LABEL_CLASS}>
            {t("dashboard.tiles.latestMediaReady")}
          </p>
          <p className="mt-1 text-sm text-neutral-400">
            {t("dashboard.tiles.latestMediaEmpty")}
          </p>
        </div>
      </div>
    );
  }

  const when = item.added_at
    ? formatRelativeTime(item.added_at, { locale })
    : null;
  const subtitle = [item.subtitle, when].filter(Boolean).join(" · ");

  const inner = (
    <>
      {item.poster_url ? (
        <img src={item.poster_url} alt="" loading="lazy" className={POSTER_CLASS} />
      ) : (
        <div className={POSTER_FALLBACK_CLASS}>
          <Film size={20} className="text-neutral-950/70" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={LABEL_CLASS}>{t("dashboard.tiles.latestMediaReady")}</p>
        <h3 className="mt-1 truncate font-display text-xl font-semibold leading-tight text-neutral-50">
          {item.title}
        </h3>
        {subtitle ? (
          <p className="mt-0.5 truncate text-[13px] text-neutral-400">
            {subtitle}
          </p>
        ) : null}
      </div>
      <span className="ml-auto flex shrink-0 items-center gap-1.5 self-center rounded-xl bg-primary-400 px-[18px] py-[11px] text-[13px] font-bold text-neutral-950">
        <Play size={14} className="fill-current" />
        {t("dashboard.tiles.latestMediaWatch")}
      </span>
    </>
  );

  return item.item_url ? (
    <a
      href={item.item_url}
      target="_blank"
      rel="noreferrer"
      className={CARD_CLASS}
    >
      {inner}
    </a>
  ) : (
    <Link to="/library" className={CARD_CLASS}>
      {inner}
    </Link>
  );
}
