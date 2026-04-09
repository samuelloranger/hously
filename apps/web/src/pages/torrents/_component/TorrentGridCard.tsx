import React, { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  usePauseQbittorrentTorrent,
  useReannounceQbittorrentTorrent,
  useResumeQbittorrentTorrent,
} from "@/hooks/useDashboard";
import type { QbittorrentTorrentListItem } from "@hously/shared/types";
import {
  formatBytes,
  formatQbittorrentEta,
  formatSpeed,
  getQbittorrentProgressBarGradient,
  getQbittorrentStatusDot,
  hasQbittorrentTransferActivity,
  isQbittorrentPausedState,
} from "@hously/shared/utils";
import {
  Tag,
  Clock,
  Play,
  Pause,
  RefreshCw,
  Pin,
  PinOff,
  MoreHorizontal,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function TorrentGridCard({
  torrent,
  isPinned,
  onTogglePin,
  isPinPending,
}: {
  torrent: QbittorrentTorrentListItem;
  isPinned: boolean;
  onTogglePin: (hash: string, nextPinned: boolean) => void;
  isPinPending: boolean;
}) {
  const { t } = useTranslation("common");
  const { dot, pulse } = getQbittorrentStatusDot(torrent.state);
  const progress = Math.round(torrent.progress * 100);
  const isActive = hasQbittorrentTransferActivity(torrent);
  const isPaused = isQbittorrentPausedState(torrent.state);
  const eta = formatQbittorrentEta(torrent.eta_seconds);
  const barGradient = getQbittorrentProgressBarGradient(torrent.state);

  const pauseMutation = usePauseQbittorrentTorrent(torrent.id);
  const resumeMutation = useResumeQbittorrentTorrent(torrent.id);
  const reannounceMutation = useReannounceQbittorrentTorrent(torrent.id);
  const isActionPending =
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    reannounceMutation.isPending;

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isActionPending) return;
    if (isPaused) resumeMutation.mutate(undefined);
    else pauseMutation.mutate(undefined);
    setDropdownOpen(false);
  };

  const handleReannounce = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isActionPending) return;
    reannounceMutation.mutate(undefined);
    setDropdownOpen(false);
  };

  const handleTogglePin = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onTogglePin(torrent.id, !isPinned);
    setDropdownOpen(false);
  };

  const actionButtons = (
    <>
      <button
        onClick={handleTogglePin}
        disabled={isPinPending}
        title={
          isPinned
            ? t("torrents.unpin", "Unpin from home")
            : t("torrents.pin", "Pin to home")
        }
        aria-label={
          isPinned
            ? t("torrents.unpin", "Unpin from home")
            : t("torrents.pin", "Pin to home")
        }
        className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 disabled:pointer-events-none disabled:opacity-30"
      >
        {isPinned ? <PinOff size={11} /> : <Pin size={11} />}
      </button>
      <button
        onClick={handleReannounce}
        disabled={isActionPending}
        title={t("torrents.reannounce", "Reannounce")}
        aria-label={t("torrents.reannounce", "Reannounce")}
        className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 disabled:pointer-events-none disabled:opacity-30"
      >
        {reannounceMutation.isPending ? (
          <span className="block w-3 h-3 rounded-full border-2 border-neutral-400 border-t-transparent animate-spin" />
        ) : (
          <RefreshCw size={11} />
        )}
      </button>
      <button
        onClick={handleToggle}
        disabled={isActionPending}
        title={
          isPaused
            ? t("torrents.start", "Resume")
            : t("torrents.pause", "Pause")
        }
        aria-label={
          isPaused
            ? t("torrents.start", "Resume")
            : t("torrents.pause", "Pause")
        }
        className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 disabled:pointer-events-none disabled:opacity-30"
      >
        {pauseMutation.isPending || resumeMutation.isPending ? (
          <span className="block w-3 h-3 rounded-full border-2 border-neutral-400 border-t-transparent animate-spin" />
        ) : isPaused ? (
          <Play size={11} />
        ) : (
          <Pause size={11} />
        )}
      </button>
    </>
  );

  return (
    <Link
      to="/torrents/$hash"
      params={{ hash: torrent.id }}
      className="group block rounded-2xl border border-neutral-200 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-sm transition-all overflow-hidden"
    >
      {/* Status accent bar */}
      <div className={cn("h-1 w-full", dot)} />

      <div className="p-3">
        {/* Status dot + name */}
        <div className="flex items-start gap-2">
          <span
            className={cn(
              "mt-1 block w-2 h-2 rounded-full shrink-0",
              dot,
              pulse && "animate-pulse",
            )}
          />
          <p className="flex-1 text-[13px] font-medium text-neutral-900 dark:text-neutral-100 line-clamp-2 leading-snug min-w-0 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {torrent.name}
          </p>
        </div>

        {/* Category badge */}
        {torrent.category && (
          <div className="mt-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800">
              <Tag size={9} />
              {torrent.category}
            </span>
          </div>
        )}

        {/* Progress bar */}
        <div className="mt-2.5 h-1 w-full rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              barGradient,
            )}
            style={{ width: `${Math.max(2, progress)}%` }}
          />
        </div>

        {/* Stats */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 tabular-nums">
            {progress}%
          </span>
          <span className="font-mono text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums">
            {formatBytes(torrent.size_bytes)}
          </span>
          {isActive && eta !== "∞" && (
            <span className="inline-flex items-center gap-0.5 font-mono text-[11px] text-neutral-400 tabular-nums">
              <Clock size={9} />
              {eta}
            </span>
          )}
          {torrent.download_speed > 0 && (
            <span className="font-mono text-[11px] text-sky-600 dark:text-sky-400 tabular-nums">
              ↓ {formatSpeed(torrent.download_speed)}
            </span>
          )}
          {torrent.upload_speed > 0 && (
            <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 tabular-nums">
              ↑ {formatSpeed(torrent.upload_speed)}
            </span>
          )}
          {torrent.ratio != null && !isActive && (
            <span className="font-mono text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums">
              {t("torrents.shareRatio", "Ratio")}: {torrent.ratio.toFixed(2)}
            </span>
          )}
        </div>

        {/* Quick actions */}
        <div className="mt-2.5 flex items-center justify-end gap-1">
          {/* Desktop: inline buttons on hover */}
          <div className="hidden sm:flex sm:opacity-0 sm:group-hover:opacity-100 items-center gap-1 transition-opacity">
            {actionButtons}
          </div>

          {/* Mobile: three-dot dropdown */}
          <div
            ref={dropdownRef}
            className="relative sm:hidden"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDropdownOpen((v) => !v);
              }}
              disabled={isActionPending}
              className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 disabled:opacity-30"
              aria-label={t("common.actions", "Actions")}
            >
              {isActionPending ? (
                <span className="block w-3 h-3 rounded-full border-2 border-neutral-400 border-t-transparent animate-spin" />
              ) : (
                <MoreHorizontal size={12} />
              )}
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 bottom-full mb-1 z-50 min-w-[160px] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg py-1 overflow-hidden">
                <button
                  onClick={handleTogglePin}
                  disabled={isPinPending}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-white/[0.05] disabled:opacity-40 transition-colors"
                >
                  {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
                  {isPinned
                    ? t("torrents.unpin", "Unpin from home")
                    : t("torrents.pin", "Pin to home")}
                </button>
                <button
                  onClick={handleReannounce}
                  disabled={isActionPending}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-white/[0.05] disabled:opacity-40 transition-colors"
                >
                  <RefreshCw size={13} />
                  {t("torrents.reannounce", "Reannounce")}
                </button>
                <button
                  onClick={handleToggle}
                  disabled={isActionPending}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-white/[0.05] disabled:opacity-40 transition-colors"
                >
                  {isPaused ? <Play size={13} /> : <Pause size={13} />}
                  {isPaused
                    ? t("torrents.start", "Resume")
                    : t("torrents.pause", "Pause")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
