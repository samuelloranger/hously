import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, RotateCcw } from "lucide-react";
import Hls from "hls.js";
import { useJellyfinPlaybackInfo } from "@hously/shared";
import { useFetcher } from "@/lib/api/context";
import { ApiError } from "@/lib/api/client";
import { useJellyfinPlayer } from "./JellyfinPlayerContext";
import { PlayerControls } from "./PlayerControls";
import {
  reportPlaybackProgress,
  reportPlaybackStarted,
  reportPlaybackStopped,
  secondsToTicks,
  ticksToSeconds,
} from "./sessionReporting";

const PROGRESS_REPORT_MS = 10_000;
const CHROME_HIDE_MS = 2500;
const RESUME_BADGE_HIDE_MS = 5000;

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function JellyfinPlayerOverlay() {
  const { itemId, isOpen, close } = useJellyfinPlayer();
  if (typeof document === "undefined") return null;
  if (!isOpen || !itemId) return null;
  return createPortal(
    <Overlay itemId={itemId} onClose={close} />,
    document.body,
  );
}

function Overlay({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const fetcher = useFetcher();
  const query = useJellyfinPlaybackInfo(itemId, fetcher);
  const data = query.data;

  // Mount-anim
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ESC closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(0);
  const pausedRef = useRef(false);
  const sessionStartedRef = useRef(false);
  const stopReportedRef = useRef(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Audio track state — driven by server-provided list, switched by reattaching HLS.
  const [activeAudioIndex, setActiveAudioIndex] = useState<number | null>(null);
  // Initialize from server's default the first time data lands.
  useEffect(() => {
    if (data && activeAudioIndex == null) {
      setActiveAudioIndex(data.default_audio_stream_index ?? null);
    }
  }, [data, activeAudioIndex]);

  const resumeSeconds = data ? ticksToSeconds(data.resume_ticks) : 0;
  const hasResume = resumeSeconds > 5;

  // Compute the effective stream URL — server's default unless the user picked
  // another track, in which case we rewrite AudioStreamIndex client-side.
  const streamUrl = (() => {
    if (!data) return null;
    if (
      activeAudioIndex == null ||
      activeAudioIndex === data.default_audio_stream_index
    ) {
      return data.stream_url;
    }
    try {
      const u = new URL(data.stream_url);
      u.searchParams.set("AudioStreamIndex", String(activeAudioIndex));
      return u.toString();
    } catch {
      return data.stream_url;
    }
  })();

  // Wire up HLS.js (Chrome/Firefox) or native HLS (Safari) when stream is ready.
  // Re-runs when streamUrl changes (audio-track switch) — preserves currentTime.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !data || !streamUrl) return;

    setVideoReady(false);
    setVideoError(null);

    // Restore position when reattaching after an audio-track switch.
    const startSeconds =
      positionRef.current > 1
        ? positionRef.current
        : hasResume
          ? resumeSeconds
          : 0;

    if (Hls.isSupported()) {
      const hls = new Hls({
        capLevelToPlayerSize: true,
        startPosition: startSeconds > 0 ? startSeconds : -1,
      });
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setVideoReady(true);
        void video.play().catch(() => undefined);
      });

      hls.on(Hls.Events.ERROR, (_event, payload) => {
        if (payload.fatal) {
          console.error("[hls] fatal", payload.type, payload.details);
          setVideoError(`Playback failed: ${payload.details ?? payload.type}`);
        }
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    // Safari (native HLS).
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
      const onLoaded = () => {
        setVideoReady(true);
        if (startSeconds > 1 && video.currentTime < 1) {
          video.currentTime = startSeconds;
        }
        void video.play().catch(() => undefined);
      };
      video.addEventListener("loadedmetadata", onLoaded, { once: true });
      return () => {
        video.removeEventListener("loadedmetadata", onLoaded);
      };
    }

    setVideoError("Your browser doesn't support HLS playback.");
    return undefined;
  }, [data, hasResume, resumeSeconds, streamUrl]);

  // Position + pause tracking from native video events.
  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (v) positionRef.current = v.currentTime;
  }, []);
  const onPause = useCallback(() => {
    pausedRef.current = true;
  }, []);
  const onPlay = useCallback(() => {
    pausedRef.current = false;
  }, []);

  // Start session once the video can actually play (after the first frame).
  const onCanPlay = useCallback(() => {
    if (sessionStartedRef.current || !data) return;
    sessionStartedRef.current = true;
    void reportPlaybackStarted({
      fetcher,
      itemId,
      positionTicks: secondsToTicks(positionRef.current),
      isPaused: false,
    });
  }, [data, fetcher, itemId]);

  // Periodic progress reporting.
  useEffect(() => {
    const interval = setInterval(() => {
      if (!sessionStartedRef.current || !data) return;
      void reportPlaybackProgress({
        fetcher,
        itemId,
        positionTicks: secondsToTicks(positionRef.current),
        isPaused: pausedRef.current,
      });
    }, PROGRESS_REPORT_MS);
    return () => clearInterval(interval);
  }, [data, fetcher, itemId]);

  // Single stop report path.
  const reportStopOnce = useCallback(() => {
    if (stopReportedRef.current || !sessionStartedRef.current) return;
    stopReportedRef.current = true;
    void reportPlaybackStopped({
      fetcher,
      itemId,
      positionTicks: secondsToTicks(positionRef.current),
    });
  }, [fetcher, itemId]);

  useEffect(() => () => reportStopOnce(), [reportStopOnce]);

  const handleClose = useCallback(() => {
    reportStopOnce();
    onClose();
  }, [onClose, reportStopOnce]);

  // Chrome auto-hide
  const [chromeVisible, setChromeVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bumpChrome = useCallback(() => {
    setChromeVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!pausedRef.current) setChromeVisible(false);
    }, CHROME_HIDE_MS);
  }, []);
  useEffect(() => {
    bumpChrome();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [bumpChrome]);

  // Resume badge
  const [resumeBadgeShown, setResumeBadgeShown] = useState(false);
  useEffect(() => {
    if (!hasResume || !data) return;
    const t1 = setTimeout(() => setResumeBadgeShown(true), 600);
    const t2 = setTimeout(
      () => setResumeBadgeShown(false),
      600 + RESUME_BADGE_HIDE_MS,
    );
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [data, hasResume]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center"
      onMouseMove={bumpChrome}
    >
      <div
        className={`absolute inset-0 bg-black/95 backdrop-blur-2xl transition-opacity duration-[280ms] ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />
      {data?.backdrop_url ? (
        <div
          aria-hidden
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-[700ms] ease-out pointer-events-none ${
            mounted ? "opacity-30" : "opacity-0"
          }`}
          style={{
            backgroundImage: `url(${data.backdrop_url})`,
            filter: "blur(40px) saturate(1.1)",
            transform: "scale(1.15)",
          }}
        />
      ) : null}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_rgba(0,0,0,0)_0%,_rgba(0,0,0,0.85)_100%)]"
      />

      <div
        className={`relative w-[min(92vw,1280px)] flex flex-col gap-4 transition-all duration-[320ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${
          mounted
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-2 scale-[0.98]"
        }`}
      >
        <header
          className={`flex items-start justify-between gap-6 transition-all duration-[260ms] ease-out ${
            chromeVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-1 pointer-events-none"
          }`}
          style={{ transitionDelay: chromeVisible ? "80ms" : "0ms" }}
        >
          <div className="min-w-0 flex-1">
            {query.isLoading ? (
              <>
                <div className="h-6 w-64 rounded bg-white/8 animate-pulse" />
                <div className="mt-2 h-3 w-40 rounded bg-white/5 animate-pulse" />
              </>
            ) : data ? (
              <>
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">
                  {data.item_type === "episode" ? "Episode" : "Movie"}
                  {data.production_year ? (
                    <>
                      <span className="text-white/20">·</span>
                      <span>{data.production_year}</span>
                    </>
                  ) : null}
                  {data.duration_ticks ? (
                    <>
                      <span className="text-white/20">·</span>
                      <span>
                        {formatClock(ticksToSeconds(data.duration_ticks))}
                      </span>
                    </>
                  ) : null}
                </div>
                <h2 className="mt-1.5 text-2xl font-light tracking-tight text-white leading-tight">
                  {data.title}
                </h2>
                {data.overview ? (
                  <p className="mt-1.5 text-[12px] text-white/55 max-w-[58ch] line-clamp-2 leading-relaxed">
                    {data.overview}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close player"
            className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/10 text-white/70 hover:text-white hover:border-white/30 hover:bg-white/5 transition-all duration-200"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </header>

        <div
          ref={frameRef}
          className="group/frame relative aspect-video w-full overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-[0_50px_120px_-30px_rgba(0,0,0,0.9)] bg-black"
          onDoubleClick={() => {
            if (document.fullscreenElement) document.exitFullscreen();
            else frameRef.current?.requestFullscreen();
          }}
        >
          <video
            ref={videoRef}
            playsInline
            preload="auto"
            crossOrigin="anonymous"
            className="absolute inset-0 h-full w-full bg-black"
            onCanPlay={onCanPlay}
            onTimeUpdate={onTimeUpdate}
            onPause={onPause}
            onPlay={onPlay}
            onClick={(e) => {
              // Toggle play/pause on single click in the video area (not the controls).
              const v = videoRef.current;
              if (!v) return;
              if (e.target === v) {
                if (v.paused) v.play().catch(() => undefined);
                else v.pause();
              }
            }}
            onError={() => {
              const err = videoRef.current?.error;
              if (err) setVideoError(`Video error: code ${err.code}`);
            }}
          />

          {videoReady && data ? (
            <PlayerControls
              videoRef={videoRef}
              hlsRef={hlsRef}
              visible={chromeVisible}
              onActivity={bumpChrome}
              containerRef={frameRef}
              audioStreams={data.audio_streams}
              activeAudioIndex={activeAudioIndex}
              onSwitchAudio={(index) => {
                setActiveAudioIndex(index);
              }}
            />
          ) : null}

          {/* Loading skeleton — shown until the video's first frame is ready */}
          {query.isLoading || (!videoReady && !videoError) ? (
            <PlayerSkeleton />
          ) : null}

          {query.isError ? (
            <PlayerError
              message={extractErrorMessage(query.error)}
              onRetry={() => void query.refetch()}
              onClose={handleClose}
            />
          ) : null}

          {videoError && !query.isError ? (
            <PlayerError
              message={videoError}
              onRetry={() => {
                setVideoError(null);
                if (hlsRef.current && data) {
                  hlsRef.current.recoverMediaError();
                }
              }}
              onClose={handleClose}
            />
          ) : null}

          {data && hasResume ? (
            <div
              className={`pointer-events-none absolute left-4 bottom-20 z-10 transition-all duration-[400ms] ease-out ${
                resumeBadgeShown
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 -translate-x-2"
              }`}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/55 backdrop-blur-md px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/80">
                <RotateCcw
                  size={11}
                  strokeWidth={2}
                  className="text-white/60"
                />
                <span>Resuming at {formatClock(resumeSeconds)}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PlayerSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.06)_50%,rgba(255,255,255,0.02)_100%)] bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite]" />
      <div className="relative">
        <div className="h-12 w-12 rounded-full border border-white/15" />
        <div className="absolute inset-0 h-12 w-12 rounded-full border-t border-white/40 animate-spin" />
      </div>
    </div>
  );
}

function PlayerError({
  message,
  onRetry,
  onClose,
}: {
  message: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center bg-black">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-400/80">
        Playback unavailable
      </p>
      <p className="max-w-md text-sm font-light text-white/85 leading-relaxed">
        {message}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[12px] font-medium text-white/90 hover:bg-white/10 hover:border-white/25 transition-colors"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-4 py-1.5 text-[12px] font-medium text-white/55 hover:text-white/85 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.apiError() ?? err.message;
  if (err instanceof Error) return err.message;
  return "Unable to load this title from Jellyfin.";
}
