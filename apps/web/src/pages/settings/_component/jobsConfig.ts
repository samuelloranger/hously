import type { LucideIcon } from "lucide-react";
import {
  Clock,
  CalendarDays,
  Activity,
  Eraser,
  FileText,
  Film,
  Flame,
  Clapperboard,
  Tv,
  RefreshCw,
  Download,
  ShieldAlert,
  Package,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Job action config
// ---------------------------------------------------------------------------

export type JobAction =
  | "check_reminders"
  | "check_all_day_events"
  | "check_habit_reminders"
  | "cleanup_notifications"
  | "fetch_c411_stats"
  | "fetch_torr9_stats"
  | "fetch_la_cale_stats"
  | "refresh_upcoming"
  | "refresh_habits_streaks"
  | "check_movie_release_reminders"
  | "check_library_movie_releases"
  | "check_library_episode_releases"
  | "sync_library_show_episodes"
  | "check_library_download_completion"
  | "sync_library_attention_alerts"
  | "check_library_integrity"
  | "refresh_github_releases";

export type JobConfig = {
  action: JobAction;
  jobNames: string[];
  Icon: LucideIcon;
  labelKey: string;
  descriptionKey: string;
};

export const JOBS: JobConfig[] = [
  {
    action: "check_reminders",
    jobNames: ["check-reminders"],
    Icon: Clock,
    labelKey: "settings.jobs.actions.checkReminders.label",
    descriptionKey: "settings.jobs.actions.checkReminders.description",
  },
  {
    action: "check_all_day_events",
    jobNames: ["check-all-day-events"],
    Icon: CalendarDays,
    labelKey: "settings.jobs.actions.checkAllDayEvents.label",
    descriptionKey: "settings.jobs.actions.checkAllDayEvents.description",
  },
  {
    action: "check_habit_reminders",
    jobNames: ["check-habit-reminders"],
    Icon: Activity,
    labelKey: "settings.jobs.actions.checkHabitReminders.label",
    descriptionKey: "settings.jobs.actions.checkHabitReminders.description",
  },
  {
    action: "cleanup_notifications",
    jobNames: ["cleanup-notifications"],
    Icon: Eraser,
    labelKey: "settings.jobs.actions.cleanupNotifications.label",
    descriptionKey: "settings.jobs.actions.cleanupNotifications.description",
  },
  {
    action: "fetch_c411_stats",
    jobNames: ["fetch-c411-stats"],
    Icon: FileText,
    labelKey: "settings.jobs.actions.fetchC411Stats.label",
    descriptionKey: "settings.jobs.actions.fetchC411Stats.description",
  },
  {
    action: "fetch_torr9_stats",
    jobNames: ["fetch-torr9-stats"],
    Icon: FileText,
    labelKey: "settings.jobs.actions.fetchTorr9Stats.label",
    descriptionKey: "settings.jobs.actions.fetchTorr9Stats.description",
  },
  {
    action: "fetch_la_cale_stats",
    jobNames: ["fetch-la-cale-stats"],
    Icon: FileText,
    labelKey: "settings.jobs.actions.fetchLaCaleStats.label",
    descriptionKey: "settings.jobs.actions.fetchLaCaleStats.description",
  },
  {
    action: "refresh_upcoming",
    jobNames: ["refresh-upcoming"],
    Icon: Film,
    labelKey: "settings.jobs.actions.refreshUpcoming.label",
    descriptionKey: "settings.jobs.actions.refreshUpcoming.description",
  },
  {
    action: "refresh_habits_streaks",
    jobNames: ["refresh-habits-streaks"],
    Icon: Flame,
    labelKey: "settings.jobs.actions.refreshHabitsStreaks.label",
    descriptionKey: "settings.jobs.actions.refreshHabitsStreaks.description",
  },
  {
    action: "check_movie_release_reminders",
    jobNames: ["check-movie-release-reminders"],
    Icon: Clapperboard,
    labelKey: "settings.jobs.actions.checkMovieReleaseReminders.label",
    descriptionKey:
      "settings.jobs.actions.checkMovieReleaseReminders.description",
  },
  {
    action: "check_library_movie_releases",
    jobNames: ["check-library-movie-releases"],
    Icon: Film,
    labelKey: "settings.jobs.actions.checkLibraryMovieReleases.label",
    descriptionKey:
      "settings.jobs.actions.checkLibraryMovieReleases.description",
  },
  {
    action: "check_library_episode_releases",
    jobNames: ["check-library-episode-releases"],
    Icon: Tv,
    labelKey: "settings.jobs.actions.checkLibraryEpisodeReleases.label",
    descriptionKey:
      "settings.jobs.actions.checkLibraryEpisodeReleases.description",
  },
  {
    action: "sync_library_show_episodes",
    jobNames: ["sync-library-show-episodes"],
    Icon: RefreshCw,
    labelKey: "settings.jobs.actions.syncLibraryShowEpisodes.label",
    descriptionKey: "settings.jobs.actions.syncLibraryShowEpisodes.description",
  },
  {
    action: "check_library_download_completion",
    jobNames: ["check-library-download-completion"],
    Icon: Download,
    labelKey: "settings.jobs.actions.checkLibraryDownloadCompletion.label",
    descriptionKey:
      "settings.jobs.actions.checkLibraryDownloadCompletion.description",
  },
  {
    action: "sync_library_attention_alerts",
    jobNames: ["sync-library-attention-alerts"],
    Icon: Clapperboard,
    labelKey: "settings.jobs.actions.syncLibraryAttentionAlerts.label",
    descriptionKey:
      "settings.jobs.actions.syncLibraryAttentionAlerts.description",
  },
  {
    action: "check_library_integrity",
    jobNames: ["check-library-integrity"],
    Icon: ShieldAlert,
    labelKey: "settings.jobs.actions.checkLibraryIntegrity.label",
    descriptionKey: "settings.jobs.actions.checkLibraryIntegrity.description",
  },
  {
    action: "refresh_github_releases",
    jobNames: ["refresh-github-releases"],
    Icon: Package,
    labelKey: "settings.jobs.actions.refreshGithubReleases.label",
    descriptionKey: "settings.jobs.actions.refreshGithubReleases.description",
  },
];
