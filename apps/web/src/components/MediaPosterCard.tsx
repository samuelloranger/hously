import { useState, type CSSProperties, type ReactNode } from 'react';

export type MediaPosterCardStatus = 'downloaded' | 'downloading' | 'missing';

const STATUS_COLORS: Record<MediaPosterCardStatus, string> = {
  downloaded: 'bg-emerald-400',
  downloading: 'bg-sky-400',
  missing: 'bg-amber-400',
};

export type MediaPosterCardProps = {
  posterUrl?: string | null;
  title: string;
  fallbackEmoji?: string;

  status?: MediaPosterCardStatus;
  statusLabel?: string;

  /** Extra content revealed below the title on hover (meta, actions, etc.) */
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
  accentRingClassName = 'focus:ring-indigo-400/60',
  className,
  style,
  animationDelayMs,
}: MediaPosterCardProps) {
  const [imageError, setImageError] = useState(false);
  const showImage = Boolean(posterUrl) && !imageError;

  const containerClass = [
    'group relative shrink-0 overflow-hidden rounded-2xl',
    'border border-white/10 bg-neutral-900 shadow-sm shadow-black/20',
    'transition-[border-color,box-shadow] duration-300 ease-out',
    'hover:border-white/20 hover:shadow-md hover:shadow-black/25',
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
          className="absolute inset-0 h-full w-full object-cover brightness-[0.85] scale-100 transition-[filter,transform] duration-700 ease-out group-hover:brightness-100 group-hover:scale-105"
        />
      )}

      {/* Fallback */}
      {!showImage && (
        <div className="absolute inset-0 flex items-center justify-center text-4xl text-white/40">
          {fallbackEmoji}
        </div>
      )}

      {/* Light gradient — just enough to read the title */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent transition-opacity duration-300 group-hover:from-black/60" />

      {/* Soft inner ring */}
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.06]" />

      {/* Status dot */}
      {status && (
        <div className="absolute top-2 right-2 z-20">
          <span
            title={statusLabel}
            className={`block h-2 w-2 rounded-full ${STATUS_COLORS[status]} ring-1.5 ring-black/20 shadow-sm`}
          />
        </div>
      )}

      {/* Glass panel — always visible at bottom */}
      <div className="absolute inset-x-0 bottom-0 z-20">
        <div className="bg-black/30 px-2.5 pt-2 pb-2.5 backdrop-blur-xl">
          <p className="text-[11px] font-semibold text-white truncate leading-snug">
            {title}
          </p>
          {children && <div className="pt-1">{children}</div>}
        </div>
      </div>

      {/* Status strip */}
      {status && (
        <div className={`absolute inset-x-0 bottom-0 h-px ${STATUS_COLORS[status]} z-30 opacity-80`} />
      )}
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
