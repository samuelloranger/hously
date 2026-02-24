import { useState, type CSSProperties, type ReactNode } from 'react';

export type MediaPosterCardStatus = 'downloaded' | 'downloading' | 'missing';

const STATUS_COLORS: Record<MediaPosterCardStatus, string> = {
  downloaded: 'bg-emerald-500',
  downloading: 'bg-sky-500',
  missing: 'bg-amber-400',
};

export type MediaPosterCardProps = {
  posterUrl?: string | null;
  title: string;
  fallbackEmoji?: string;

  /** Shows a colored dot (top-right) and a thin strip at bottom */
  status?: MediaPosterCardStatus;
  statusLabel?: string;

  /**
   * Actions rendered on hover.
   * 'left-column'     → vertical pill column on the left (library mode)
   * 'center-overlay'  → translucent overlay with centered actions (explore/shelf mode)
   */
  actionsSlot?: ReactNode;
  actionsLayout?: 'left-column' | 'center-overlay';

  /** Content rendered inside the glass bottom panel */
  children?: ReactNode;

  /** Container element — inferred from href / onClick */
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
  fallbackEmoji = '🎞️',
  status,
  statusLabel,
  actionsSlot,
  actionsLayout = 'center-overlay',
  children,
  href,
  target,
  rel,
  onClick,
  disabled,
  accentRingClassName = 'focus:ring-indigo-400/70',
  className,
  style,
  animationDelayMs,
}: MediaPosterCardProps) {
  const [imageError, setImageError] = useState(false);
  const showImage = Boolean(posterUrl) && !imageError;

  const containerClass = [
    'group relative shrink-0 overflow-hidden rounded-2xl',
    'border border-white/15 bg-neutral-900 shadow-sm shadow-black/30',
    'transition-all hover:-translate-y-0.5 hover:border-white/25 hover:shadow-black/40',
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
        <div className="absolute inset-0 flex items-center justify-center text-4xl text-white/60">
          {fallbackEmoji}
        </div>
      )}

      {/* Gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/5 opacity-90 transition-opacity duration-300 group-hover:opacity-75" />

      {/* Inner ring */}
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />

      {/* Status dot — top-right */}
      {status && (
        <div className="absolute top-2 right-2 z-20">
          <span
            title={statusLabel}
            className={`block h-2 w-2 rounded-full ${STATUS_COLORS[status]} ring-2 ring-black/30`}
          />
        </div>
      )}

      {/* Left-column actions */}
      {actionsSlot && actionsLayout === 'left-column' && (
        <div className="absolute left-0 top-0 bottom-0 z-20 flex flex-col items-center justify-center gap-1.5 px-1.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
          {actionsSlot}
        </div>
      )}

      {/* Center-overlay actions */}
      {actionsSlot && actionsLayout === 'center-overlay' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          {actionsSlot}
        </div>
      )}

      {/* Glass bottom panel */}
      {children && (
        <div className="relative z-10 flex h-full flex-col justify-end">
          <div className="min-w-0 rounded-xl bg-black/35 p-2 backdrop-blur-md ring-1 ring-inset ring-white/10">
            {children}
          </div>
        </div>
      )}

      {/* Status strip at bottom edge */}
      {status && <div className={`absolute inset-x-0 bottom-0 h-0.5 ${STATUS_COLORS[status]}`} />}
    </>
  );

  if (href) {
    return (
      <a
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
    <article className={containerClass} style={combinedStyle} role="group" aria-label={title}>
      {content}
    </article>
  );
}
