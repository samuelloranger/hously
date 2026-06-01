import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useBlocker } from "@tanstack/react-router";
import { Play, Pause, RotateCcw, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "Focus", minutes: 25, color: "bg-violet-500" },
  { label: "Short", minutes: 15, color: "bg-sky-500" },
  { label: "Break", minutes: 5, color: "bg-emerald-500" },
] as const;

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  } catch {
    // AudioContext unavailable
  }
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const PRESET_STORAGE_KEY = "focus-timer-preset";

export function FocusTimerPanel() {
  const { t } = useTranslation("common");
  const [preset, setPreset] = useState(() => {
    const saved = localStorage.getItem(PRESET_STORAGE_KEY);
    const idx = saved !== null ? Number(saved) : 0;
    return idx >= 0 && idx < PRESETS.length ? idx : 0;
  });
  const [totalSeconds, setTotalSeconds] = useState(
    () => PRESETS[preset].minutes * 60,
  );
  const [remaining, setRemaining] = useState(
    () => PRESETS[preset].minutes * 60,
  );
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useBlocker({
    blockerFn: () => !window.confirm(t("dashboard.focusTimer.blockerMessage")),
    condition: running,
  });

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    if (running) {
      window.addEventListener("beforeunload", handler);
    }
    return () => window.removeEventListener("beforeunload", handler);
  }, [running]);

  const clear = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clear();
          setRunning(false);
          setDone(true);
          beep();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return clear;
  }, [running, clear]);

  const selectPreset = (idx: number) => {
    clear();
    setRunning(false);
    setDone(false);
    setPreset(idx);
    localStorage.setItem(PRESET_STORAGE_KEY, String(idx));
    const secs = PRESETS[idx].minutes * 60;
    setTotalSeconds(secs);
    setRemaining(secs);
  };

  const toggle = () => {
    if (done) return;
    setRunning((r) => !r);
  };

  const reset = () => {
    clear();
    setRunning(false);
    setDone(false);
    setRemaining(totalSeconds);
  };

  const progress =
    totalSeconds > 0 ? (totalSeconds - remaining) / totalSeconds : 0;
  const circumference = 2 * Math.PI * 36;
  const strokeOffset = circumference * (1 - progress);
  const activeColor = PRESETS[preset].color;

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-neutral-800">
        <span className={cn("w-1 h-4 rounded-full shrink-0", activeColor)} />
        <Timer
          className="w-4 h-4 shrink-0 text-neutral-400"
          strokeWidth={2}
        />
        <h3 className="text-sm font-semibold text-neutral-100">
          {t("dashboard.focusTimer.title")}
        </h3>
      </div>

      <div className="px-4 py-5 flex flex-col items-center gap-5">
        {/* Preset pills */}
        <div className="flex gap-2">
          {PRESETS.map((p, idx) => (
            <button
              key={p.label}
              onClick={() => selectPreset(idx)}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-full transition-colors",
                preset === idx
                  ? cn(p.color, "text-white")
                  : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700",
              )}
            >
              {t(`dashboard.focusTimer.preset${p.label}`)} {p.minutes}m
            </button>
          ))}
        </div>

        {/* Ring + time */}
        <div className="relative flex items-center justify-center">
          <svg
            width="96"
            height="96"
            viewBox="0 0 96 96"
            className="-rotate-90"
          >
            <circle
              cx="48"
              cy="48"
              r="36"
              fill="none"
              stroke="currentColor"
              className="text-neutral-800"
              strokeWidth="6"
            />
            <circle
              cx="48"
              cy="48"
              r="36"
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              className={cn(
                "transition-all duration-1000",
                done ? "text-emerald-500" : activeColor.replace("bg-", "text-"),
              )}
              stroke="currentColor"
            />
          </svg>
          <span
            className={cn(
              "absolute text-2xl font-bold tabular-nums tracking-tight",
              done ? "text-emerald-500" : "text-neutral-100",
            )}
          >
            {done ? t("dashboard.focusTimer.done") : formatTime(remaining)}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
            title={t("dashboard.focusTimer.reset")}
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={toggle}
            disabled={done}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-40",
              activeColor,
              !done && "hover:opacity-90",
            )}
          >
            {running ? <Pause size={14} /> : <Play size={14} />}
            {running
              ? t("dashboard.focusTimer.pause")
              : t("dashboard.focusTimer.start")}
          </button>
        </div>
      </div>
    </section>
  );
}
