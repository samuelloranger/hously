import type { CSSProperties } from 'react';
import { MediaPosterCard } from '../../../components/MediaPosterCard';

type MovieCardBaseProps = {
  title: string;
  subtitle?: string | null;
  type: string;
  releaseDate?: string | null;
  posterUrl?: string | null;
  fallbackEmoji?: string;
  accentRingClassName: string;
  className?: string;
  style?: CSSProperties;
  animationDelayMs?: number;
};

type MovieCardLinkProps = {
  href: string;
  target?: string;
  rel?: string;
  onClick?: never;
  disabled?: never;
};

type MovieCardButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  href?: never;
  target?: never;
  rel?: never;
};

type MovieCardStaticProps = {
  href?: never;
  target?: never;
  rel?: never;
  onClick?: never;
  disabled?: never;
};

export type MovieCardProps = MovieCardBaseProps & (MovieCardLinkProps | MovieCardButtonProps | MovieCardStaticProps);

export function MovieCard(props: MovieCardProps) {
  const {
    title,
    subtitle,
    type,
    releaseDate,
    posterUrl,
    fallbackEmoji,
    accentRingClassName,
    className,
    style,
    animationDelayMs,
  } = props;

  return (
    <MediaPosterCard
      posterUrl={posterUrl}
      title={title}
      fallbackEmoji={fallbackEmoji}
      accentRingClassName={accentRingClassName}
      className={`w-[130px] md:w-[150px] shrink-0${className ? ` ${className}` : ''}`}
      style={style}
      animationDelayMs={animationDelayMs}
      href={'href' in props ? props.href : undefined}
      target={'href' in props ? props.target : undefined}
      rel={'href' in props ? props.rel : undefined}
      onClick={'onClick' in props ? props.onClick : undefined}
      disabled={'onClick' in props ? props.disabled : undefined}
    >
      <p className="text-[11px] font-semibold text-white truncate">{title}</p>
      {subtitle ? <p className="mt-0.5 text-[10px] text-white/80 truncate">{subtitle}</p> : null}
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/90">
          {type}
        </span>
        {releaseDate ? <span className="text-[9px] text-white/80">{releaseDate}</span> : null}
      </div>
    </MediaPosterCard>
  );
}
