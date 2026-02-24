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
   * Content rendered inside the glass panel that slides up on hover.
   * Typically: smaller title, meta row (year/badge), and action buttons.
   */
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
  fallbackEmoji = '🎞️',
  status,
  statusLabel,
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
    'hover:border-white/25 hover:shadow-black/40 transition-[border-color,box-shadow]',
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

      {/* Gradient — stronger at bottom to frame the title */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

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

      {/* Default state: large title visible at bottom, fades out on hover */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-2.5 pb-3 pt-10 opacity-100 transition-opacity duration-150 group-hover:opacity-0">
        <p className="text-[13px] font-bold text-white line-clamp-2 leading-snug drop-shadow-sm">
          {title}
        </p>
      </div>

      {/* Hover state: glass panel slides up from bottom */}
      {children && (
        <div className="absolute inset-x-0 bottom-0 z-20 translate-y-full transition-transform duration-200 ease-out group-hover:translate-y-0">
          <div className="rounded-t-xl bg-black/60 p-2 pb-2.5 backdrop-blur-md ring-1 ring-inset ring-white/10">
            {children}
          </div>
        </div>
      )}

      {/* Status strip — sits above everything at the bottom edge */}
      {status && <div className={`absolute inset-x-0 bottom-0 h-0.5 ${STATUS_COLORS[status]} z-30`} />}
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
