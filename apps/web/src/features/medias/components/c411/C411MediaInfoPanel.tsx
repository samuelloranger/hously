import { Loader2, AudioLines } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BADGE_NEUTRAL, CARD, langBadgeClass, BADGE_BASE } from './c411-utils';

interface Props {
  data: any;
  isLoading: boolean;
}

export function C411MediaInfoPanel({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!data?.media_info) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-700/60">
          <AudioLines className="h-5 w-5 text-neutral-400" />
        </div>
        <p className="text-sm font-medium text-neutral-900 dark:text-white">No media info</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Could not read media file</p>
      </div>
    );
  }

  const mi = data.media_info;

  return (
    <div className="space-y-4">
      {/* Detection summary */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-lg border border-indigo-200/60 dark:border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/10 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
          {data.language_tag}
        </span>
        {mi.resolution && <span className={BADGE_NEUTRAL}>{mi.resolution}</span>}
        {mi.source && mi.source !== 'N/A' && <span className={BADGE_NEUTRAL}>{mi.source}</span>}
        {mi.video_codec && <span className={BADGE_NEUTRAL}>{mi.video_codec}</span>}
        {mi.container && <span className={BADGE_NEUTRAL}>{mi.container}</span>}
        {mi.duration && mi.duration !== 'N/A' && <span className={BADGE_NEUTRAL}>{mi.duration}</span>}
        {data.release_group && <span className={BADGE_NEUTRAL}>-{data.release_group}</span>}
      </div>

      {data.scene_name && (
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono truncate">{data.scene_name}</p>
      )}

      {/* Audio tracks */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
          Audio ({mi.audio_streams.length})
        </p>
        <div className="space-y-1.5">
          {mi.audio_streams.map((a: any, i: number) => (
            <div key={i} className={cn(CARD, 'px-3 py-2 flex items-center gap-3')}>
              <span className="text-xs font-semibold text-neutral-900 dark:text-white w-5">#{i + 1}</span>
              <span className={cn(BADGE_BASE, 'font-semibold', langBadgeClass(a.language))}>
                {a.language || 'und'}
              </span>
              {a.title && <span className="text-[11px] text-neutral-500 dark:text-neutral-400">{a.title}</span>}
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 ml-auto">{a.codec} · {a.channels} · {a.bitrate || 'N/A'}</span>
            </div>
          ))}
          {mi.audio_streams.length === 0 && (
            <p className="text-xs text-neutral-400">No audio tracks found</p>
          )}
        </div>
      </div>

      {/* Subtitle tracks */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
          Subtitles ({mi.subtitles.length})
        </p>
        <div className="space-y-1.5">
          {mi.subtitles.map((s: any, i: number) => (
            <div key={i} className={cn(CARD, 'px-3 py-1.5 flex items-center gap-3')}>
              <span className="text-xs font-semibold text-neutral-900 dark:text-white w-5">#{i + 1}</span>
              <span className={cn(BADGE_BASE, 'font-semibold', langBadgeClass(s.language))}>
                {s.language || 'und'}
              </span>
              {s.title && <span className="text-[11px] text-neutral-500 dark:text-neutral-400">{s.title}</span>}
              {s.forced && <span className="inline-flex items-center rounded-md bg-amber-100/60 dark:bg-amber-900/20 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-400">forced</span>}
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 ml-auto">{s.format}</span>
            </div>
          ))}
          {mi.subtitles.length === 0 && (
            <p className="text-xs text-neutral-400">No subtitle tracks found</p>
          )}
        </div>
      </div>
    </div>
  );
}
