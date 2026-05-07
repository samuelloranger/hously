import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type RefObject,
} from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  Maximize2,
  Minimize2,
  Languages,
} from "lucide-react";
import type Hls from "hls.js";
import type { JellyfinAudioStream } from "@hously/shared";

interface PlayerControlsProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  hlsRef: RefObject<Hls | null>;
  visible: boolean;
  onActivity: () => void;
  containerRef: RefObject<HTMLDivElement | null>;
  audioStreams: JellyfinAudioStream[];
  activeAudioIndex: number | null;
  onSwitchAudio: (index: number) => void;
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PlayerControls({
  videoRef,
  hlsRef: _hlsRef,
  visible,
  onActivity,
  containerRef,
  audioStreams,
  activeAudioIndex,
  onSwitchAudio,
}: PlayerControlsProps) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [audioMenuOpen, setAudioMenuOpen] = useState(false);
  const [volumeHover, setVolumeHover] = useState(false);
  const [scrubHover, setScrubHover] = useState(false);
  const [scrubPreviewSec, setScrubPreviewSec] = useState<number | null>(null);

  // ── Sync from <video> events ────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrentTime(v.currentTime);
    const onDur = () =>
      setDuration(Number.isFinite(v.duration) ? v.duration : 0);
    const onProgress = () => {
      try {
        if (v.buffered.length > 0)
          setBufferedEnd(v.buffered.end(v.buffered.length - 1));
      } catch {
        /* ignore */
      }
    };
    const onVol = () => {
      setVolume(v.volume);
      setMuted(v.muted);
    };
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("durationchange", onDur);
    v.addEventListener("loadedmetadata", onDur);
    v.addEventListener("progress", onProgress);
    v.addEventListener("volumechange", onVol);
    onDur();
    onVol();
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("durationchange", onDur);
      v.removeEventListener("loadedmetadata", onDur);
      v.removeEventListener("progress", onProgress);
      v.removeEventListener("volumechange", onVol);
    };
  }, [videoRef]);

  // Audio tracks are server-driven (Jellyfin's MediaStreams) — switching reloads
  // the HLS source via onSwitchAudio in the parent, so nothing to wire here.

  // ── Fullscreen state ────────────────────────────────────────────────────────
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // ── Actions (above keyboard handler — hooks immutability rule) ─────────────
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => undefined);
    else v.pause();
  }, [videoRef]);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.volume === 0) v.volume = 0.5;
  }, [videoRef]);

  const setVolumeFromValue = useCallback(
    (val: number) => {
      const v = videoRef.current;
      if (!v) return;
      const clamped = Math.max(0, Math.min(1, val));
      v.volume = clamped;
      v.muted = clamped === 0;
    },
    [videoRef],
  );

  const toggleFullscreen = useCallback(() => {
    const target = containerRef.current;
    if (!target) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else {
      target.requestFullscreen().catch(() => undefined);
    }
  }, [containerRef]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't grab keys while user types in an input
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const v = videoRef.current;
      if (!v) return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          onActivity();
          break;
        case "ArrowLeft":
          e.preventDefault();
          v.currentTime = Math.max(0, v.currentTime - 10);
          onActivity();
          break;
        case "ArrowRight":
          e.preventDefault();
          v.currentTime = Math.min(v.duration || Infinity, v.currentTime + 10);
          onActivity();
          break;
        case "ArrowUp":
          e.preventDefault();
          v.volume = Math.min(1, v.volume + 0.05);
          onActivity();
          break;
        case "ArrowDown":
          e.preventDefault();
          v.volume = Math.max(0, v.volume - 0.05);
          onActivity();
          break;
        case "m":
          e.preventDefault();
          v.muted = !v.muted;
          onActivity();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          onActivity();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onActivity, togglePlay, toggleFullscreen]);

  // ── Scrubber: pointer handling ─────────────────────────────────────────────
  const scrubRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef(false);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = scrubRef.current;
      const v = videoRef.current;
      if (!el || !v || !duration) return null;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      const seconds = ratio * duration;
      return seconds;
    },
    [duration, videoRef],
  );

  const onScrubPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragRef.current = true;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      const s = seekFromClientX(e.clientX);
      if (s != null && videoRef.current) videoRef.current.currentTime = s;
    },
    [seekFromClientX, videoRef],
  );

  const onScrubPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const s = seekFromClientX(e.clientX);
      if (s != null) setScrubPreviewSec(s);
      if (dragRef.current && s != null && videoRef.current)
        videoRef.current.currentTime = s;
    },
    [seekFromClientX, videoRef],
  );

  const onScrubPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragRef.current = false;
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    },
    [],
  );

  // ── Geometry derived ───────────────────────────────────────────────────────
  const playedRatio = duration > 0 ? currentTime / duration : 0;
  const bufferedRatio = duration > 0 ? bufferedEnd / duration : 0;
  const volumePct = (muted ? 0 : volume) * 100;
  const VolumeIcon =
    muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <>
      {/* Center play button — visible while paused */}
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? "Pause" : "Play"}
        className={`absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-300 ${
          playing ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <span className="grid place-items-center w-20 h-20 rounded-full border border-white/25 bg-black/35 backdrop-blur-sm hover:bg-black/55 hover:border-white/50 hover:scale-105 transition-all duration-200">
          <Play
            size={26}
            strokeWidth={1.25}
            className="text-white/90 translate-x-[1px]"
            fill="currentColor"
          />
        </span>
      </button>

      {/* Bottom bar */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 transition-opacity duration-[260ms] ease-out ${
          visible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onMouseMove={onActivity}
      >
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/85 via-black/55 to-transparent pointer-events-none" />

        <div className="relative flex flex-col gap-2 px-5 pt-6 pb-4">
          {/* Scrubber */}
          <div
            ref={scrubRef}
            className="relative h-5 flex items-center cursor-pointer touch-none select-none"
            onPointerDown={onScrubPointerDown}
            onPointerMove={onScrubPointerMove}
            onPointerUp={onScrubPointerUp}
            onPointerEnter={() => setScrubHover(true)}
            onPointerLeave={() => {
              setScrubHover(false);
              setScrubPreviewSec(null);
              dragRef.current = false;
            }}
          >
            {/* Track */}
            <div
              className={`absolute left-0 right-0 rounded-full bg-white/10 transition-all duration-150 ${
                scrubHover ? "h-1" : "h-[2px]"
              }`}
            />
            {/* Buffered */}
            <div
              className={`absolute left-0 rounded-full bg-white/22 transition-all duration-150 ${
                scrubHover ? "h-1" : "h-[2px]"
              }`}
              style={{ width: `${bufferedRatio * 100}%` }}
            />
            {/* Played (amber) */}
            <div
              className={`absolute left-0 rounded-full transition-all duration-150 ${
                scrubHover ? "h-1" : "h-[2px]"
              }`}
              style={{
                width: `${playedRatio * 100}%`,
                background: "var(--player-accent, #F5A623)",
              }}
            />
            {/* Thumb */}
            <div
              className={`absolute z-10 -translate-x-1/2 transition-all duration-150 ${
                scrubHover ? "opacity-100 scale-100" : "opacity-0 scale-75"
              }`}
              style={{ left: `${playedRatio * 100}%` }}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  background: "var(--player-accent, #F5A623)",
                  boxShadow: "0 0 0 4px rgba(245, 166, 35, 0.18)",
                }}
              />
            </div>
            {/* Hover timestamp */}
            {scrubHover && scrubPreviewSec != null && duration > 0 ? (
              <ScrubTimestamp
                ratio={scrubPreviewSec / duration}
                label={formatClock(scrubPreviewSec)}
              />
            ) : null}
          </div>

          {/* Buttons row */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
              className="grid place-items-center w-9 h-9 rounded-full text-white/90 hover:bg-white/8 hover:text-white transition-colors"
            >
              {playing ? (
                <Pause size={18} strokeWidth={1.5} fill="currentColor" />
              ) : (
                <Play
                  size={18}
                  strokeWidth={1.5}
                  fill="currentColor"
                  className="translate-x-[1px]"
                />
              )}
            </button>

            {/* Volume cluster */}
            <div
              className="flex items-center"
              onMouseEnter={() => setVolumeHover(true)}
              onMouseLeave={() => setVolumeHover(false)}
            >
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? "Unmute" : "Mute"}
                className="grid place-items-center w-9 h-9 rounded-full text-white/85 hover:bg-white/8 hover:text-white transition-colors"
              >
                <VolumeIcon size={16} strokeWidth={1.5} />
              </button>
              <div
                className={`flex items-center overflow-hidden transition-[width,opacity] duration-200 ease-out ${
                  volumeHover ? "w-24 opacity-100 ml-1" : "w-0 opacity-0"
                }`}
              >
                <VolumeSlider
                  value={volumePct}
                  onChange={(p) => setVolumeFromValue(p / 100)}
                />
              </div>
            </div>

            {/* Time */}
            <div
              className="font-mono text-[12px] tabular-nums text-white/85 ml-2"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              <span>{formatClock(currentTime)}</span>
              <span className="mx-1.5 text-white/30">/</span>
              <span className="text-white/55">{formatClock(duration)}</span>
            </div>

            <div className="flex-1" />

            {/* Audio track menu — only render when there's a real choice */}
            {audioStreams.length > 1 ? (
              <AudioTrackMenu
                open={audioMenuOpen}
                onToggle={() => setAudioMenuOpen((v) => !v)}
                onClose={() => setAudioMenuOpen(false)}
                streams={audioStreams}
                activeIndex={activeAudioIndex}
                onSelect={(index) => {
                  onSwitchAudio(index);
                  setAudioMenuOpen(false);
                }}
              />
            ) : null}

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              className="grid place-items-center w-9 h-9 rounded-full text-white/85 hover:bg-white/8 hover:text-white transition-colors"
            >
              {isFullscreen ? (
                <Minimize2 size={16} strokeWidth={1.5} />
              ) : (
                <Maximize2 size={16} strokeWidth={1.5} />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ScrubTimestamp({ ratio, label }: { ratio: number; label: string }) {
  return (
    <div
      className="absolute -top-9 -translate-x-1/2 pointer-events-none"
      style={{ left: `${Math.max(0, Math.min(1, ratio)) * 100}%` }}
    >
      <div className="rounded-md border border-white/15 bg-black/80 backdrop-blur-md px-2 py-1 font-mono text-[11px] tabular-nums text-white/90">
        {label}
      </div>
    </div>
  );
}

function VolumeSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (pct: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const updateFromX = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onChange(ratio * 100);
  };

  return (
    <div
      ref={ref}
      className="relative h-5 w-full flex items-center cursor-pointer touch-none"
      onPointerDown={(e) => {
        draggingRef.current = true;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        updateFromX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (draggingRef.current) updateFromX(e.clientX);
      }}
      onPointerUp={(e) => {
        draggingRef.current = false;
        (e.target as Element).releasePointerCapture?.(e.pointerId);
      }}
    >
      <div className="absolute inset-x-0 h-[2px] rounded-full bg-white/15" />
      <div
        className="absolute left-0 h-[2px] rounded-full bg-white/85"
        style={{ width: `${value}%` }}
      />
      <div
        className="absolute -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white/90"
        style={{ left: `${value}%` }}
      />
    </div>
  );
}

function AudioTrackMenu({
  open,
  onToggle,
  onClose,
  streams,
  activeIndex,
  onSelect,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  streams: JellyfinAudioStream[];
  activeIndex: number | null;
  onSelect: (index: number) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-label="Audio track"
        aria-expanded={open}
        className={`grid place-items-center w-9 h-9 rounded-full transition-colors ${
          open
            ? "bg-white/10 text-white"
            : "text-white/85 hover:bg-white/8 hover:text-white"
        }`}
      >
        <Languages size={16} strokeWidth={1.5} />
      </button>

      <div
        className={`absolute right-0 bottom-[calc(100%+10px)] origin-bottom-right transition-all duration-200 ease-out ${
          open
            ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
            : "opacity-0 translate-y-1 scale-[0.98] pointer-events-none"
        }`}
      >
        <div className="min-w-[200px] rounded-xl border border-white/10 bg-black/85 backdrop-blur-xl shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)]">
          <div className="px-3.5 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">
            Audio
          </div>
          <ul className="pb-1.5">
            {streams.map((s) => {
              const isActive = s.index === activeIndex;
              return (
                <li key={s.index}>
                  <button
                    type="button"
                    onClick={() => onSelect(s.index)}
                    className={`group/track w-full flex items-center gap-3 px-3.5 py-2 text-left transition-colors ${
                      isActive ? "" : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <span
                      className="block h-1.5 w-1.5 rounded-full transition-all"
                      style={{
                        background: isActive
                          ? "var(--player-accent, #F5A623)"
                          : "rgba(255,255,255,0.18)",
                        boxShadow: isActive
                          ? "0 0 0 3px rgba(245, 166, 35, 0.18)"
                          : undefined,
                      }}
                    />
                    <span
                      className={`flex-1 text-[13px] font-light leading-tight ${
                        isActive ? "" : "text-white/75"
                      }`}
                      style={{
                        color: isActive
                          ? "var(--player-accent, #F5A623)"
                          : undefined,
                      }}
                    >
                      {s.display_title}
                    </span>
                    {s.language ? (
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">
                        {s.language}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
