import { useState, type CSSProperties, type ReactNode } from 'react';

export type MediaPosterCardStatus = 'downloaded' | 'downloading' | 'missing';

const STATUS_BORDER_COLORS: Record<MediaPosterCardStatus, string> = {
  downloaded: 'bg-emerald-400',
  downloading: 'bg-sky-400',
  missing: 'bg-amber-400',
};

export type MediaPosterCardProps = {
  posterUrl?: string | null;
  title: string;
  id?: string;
  fallbackEmoji?: string;

  status?: MediaPosterCardStatus;
  statusLabel?: string;

  /** Slot for top-left badge (e.g. C411 logo) */
  topLeftBadge?: ReactNode;
  /** Slot for top-right overlay content (e.g. dropdown menu) */
  topRightContent?: ReactNode;
  /** Tags shown vertically on the left on hover (e.g. release info) */
  hoverTags?: string[];

  /** Extra content revealed below the title (meta, actions, etc.) */
  children?: ReactNode;

  href?: string;
  target?: string;
  rel?: string;
  onClick?: () => void;
  disabled?: boolean;

  accentRingClassName?: string;
  className?: string;
  style?: CSSProperties;
  animationDelayMs?: number;
};

export function MediaPosterCard({
  posterUrl,
  title,
  id,
  fallbackEmoji = '🎞️',
  status,
  statusLabel,
  topLeftBadge,
  topRightContent,
  hoverTags,
  children,
  href,
  target,
  rel,
  onClick,
  disabled,
  accentRingClassName = 'focus:ring-indigo-400/60',
  className,
  style,
  animationDelayMs,
}: MediaPosterCardProps) {
  const [imageError, setImageError] = useState(false);
  const showImage = Boolean(posterUrl) && !imageError;

  const containerClass = [
    'group/card relative shrink-0 overflow-hidden rounded-2xl',
    'border border-white/10 bg-neutral-900 shadow-sm shadow-black/20',
    'transition-[border-color,box-shadow,ring] duration-300 ease-out',
    'hover:border-white/20 hover:shadow-md hover:shadow-black/30',
    'focus:outline-none focus:ring-2',
    accentRingClassName,
    disabled ? 'opacity-60 cursor-not-allowed' : '',
    'aspect-[2/3]',
    href || onClick ? 'cursor-pointer text-left' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const combinedStyle: CSSProperties | undefined =
    animationDelayMs !== undefined ? { ...style, animationDelay: `${animationDelayMs}ms` } : style;

  const content = (
    <>
      {/* Poster */}
      {showImage && (
        <img
          src={posterUrl!}
          alt=""
          loading="lazy"
          aria-hidden="true"
          onError={() => setImageError(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Fallback */}
      {!showImage && (
        <div className="absolute inset-0 flex items-center justify-center text-4xl text-white/40">{fallbackEmoji}</div>
      )}

      {/* Gradient + hover brighten overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-white/0 transition-[background-color] duration-300 ease-out group-hover/card:bg-white/[0.06]" />

      {/* Soft inner ring */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06]" />

      {/* Top-left badge */}
      {topLeftBadge && (
        <div className="absolute top-2 left-2 z-20">
          {topLeftBadge}
        </div>
      )}

      {/* Top-right content (dropdown, etc.) */}
      {topRightContent && (
        <div className="absolute top-1.5 right-1.5 z-20">
          {topRightContent}
        </div>
      )}

      {/* Hover tags — stacked vertically on the left */}
      {hoverTags && hoverTags.length > 0 && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1 pointer-events-none">
          {hoverTags.map((tag, i) => (
            <span
              key={tag}
              className="opacity-0 -translate-x-2 group-hover/card:opacity-100 group-hover/card:translate-x-0 transition-all duration-300 ease-out inline-flex items-center px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm border border-white/10 text-[8.5px] font-semibold text-white/80 uppercase tracking-wide whitespace-nowrap"
              style={{ transitionDelay: `${i * 50}ms` }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Glass panel — always visible at bottom */}
      <div className="absolute inset-x-0 bottom-0 z-20">
        <div className="bg-black/30 px-2.5 pt-2 pb-2.5 backdrop-blur-xl">
          <p className="text-[11px] font-semibold text-white truncate leading-snug">{title}</p>
          {children && <div className="pt-1">{children}</div>}
        </div>
      </div>

      {/* Status bottom border */}
      {status && (
        <div
          className={`absolute inset-x-0 bottom-0 h-[2.5px] ${STATUS_BORDER_COLORS[status]} z-30`}
          title={statusLabel}
        />
      )}
    </>
  );

  if (href) {
    return (
      <a
        id={id}
        className={containerClass}
        style={combinedStyle}
        href={href}
        target={target ?? '_blank'}
        rel={rel ?? 'noreferrer'}
        aria-label={title}
      >
        {content}
      </a>
    );
  }

  if (onClick) {
    return (
      <button
        id={id}
        className={containerClass}
        style={combinedStyle}
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={title}
      >
        {content}
      </button>
    );
  }

  return (
    <article
      id={id}
      className={containerClass}
      style={combinedStyle}
      role="group"
      aria-label={title}
    >
      {content}
    </article>
  );
}
