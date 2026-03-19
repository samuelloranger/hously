import { Loader2, AudioLines, Film, HardDrive, Clock, Monitor, Gauge, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatReleaseSize as formatSize, type MediaInfoResponse } from '@hously/shared';
import { BADGE_NEUTRAL, CARD, langBadgeClass, BADGE_BASE, langLabel } from './c411-utils';

interface Props {
  data: MediaInfoResponse | undefined;
  isLoading: boolean;
}

function StatCell({ icon: Icon, label, value }: { icon: typeof Film; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
        <Icon className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500">{label}</p>
        <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate">{value}</p>
      </div>
    </div>
  );
}

export function MediaInfoPanel({ data, isLoading }: Props) {
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
      {/* Detection badges */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-lg border border-indigo-200/60 dark:border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/10 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
          {langLabel(data.language_tag)}
        </span>
        {mi.resolution && <span className={BADGE_NEUTRAL}>{mi.resolution}</span>}
        {mi.source && mi.source !== 'N/A' && <span className={BADGE_NEUTRAL}>{mi.source}</span>}
        {mi.video_codec && <span className={BADGE_NEUTRAL}>{mi.video_codec}</span>}
        {mi.container && <span className={BADGE_NEUTRAL}>{mi.container}</span>}
        {data.release_group && <span className={BADGE_NEUTRAL}>-{data.release_group}</span>}
      </div>

      {data.scene_name && (
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono truncate">{data.scene_name}</p>
      )}

      {/* Stats grid */}
      <div
        className={cn(
          CARD,
          'grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-neutral-200/80 dark:divide-neutral-700/60 overflow-hidden'
        )}
      >
        {data.file_size != null && <StatCell icon={HardDrive} label="Size" value={formatSize(data.file_size)} />}
        {mi.duration && mi.duration !== 'N/A' && <StatCell icon={Clock} label="Duration" value={mi.duration} />}
        {mi.resolution && <StatCell icon={Monitor} label="Resolution" value={mi.resolution} />}
        {mi.video_bitrate && mi.video_bitrate !== 'N/A' && (
          <StatCell icon={Gauge} label="Video Bitrate" value={mi.video_bitrate} />
        )}
        {mi.video_bit_depth && mi.video_bit_depth !== 'N/A' && (
          <StatCell icon={Layers} label="Bit Depth" value={`${mi.video_bit_depth}-bit`} />
        )}
        {mi.framerate && mi.framerate !== 'N/A' && (
          <StatCell icon={Film} label="Framerate" value={`${mi.framerate} fps`} />
        )}
      </div>

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
                {langLabel(a.language) || 'und'}
              </span>
              {a.title && <span className="text-[11px] text-neutral-500 dark:text-neutral-400">{a.title}</span>}
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 ml-auto">
                {a.codec} · {a.channels} · {a.bitrate || 'N/A'}
              </span>
            </div>
          ))}
          {mi.audio_streams.length === 0 && <p className="text-xs text-neutral-400">No audio tracks found</p>}
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
                {langLabel(s.language) || 'und'}
              </span>
              {s.title && <span className="text-[11px] text-neutral-500 dark:text-neutral-400">{s.title}</span>}
              {s.forced && (
                <span className="inline-flex items-center rounded-md bg-amber-100/60 dark:bg-amber-900/20 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-400">
                  forced
                </span>
              )}
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 ml-auto">{s.format}</span>
            </div>
          ))}
          {mi.subtitles.length === 0 && <p className="text-xs text-neutral-400">No subtitle tracks found</p>}
        </div>
      </div>
    </div>
  );
}
