import { lazy } from "react";
import type { WidgetId } from "@hously/shared/constants";

export const WIDGET_COMPONENTS: Record<
  WidgetId,
  React.LazyExoticComponent<React.ComponentType<object>>
> = {
  weather: lazy(() =>
    import("@/pages/_component/WeatherPanel").then((m) => ({
      default: m.WeatherPanel,
    })),
  ),
  quick_links: lazy(() =>
    import("@/pages/_component/QuickLinksPanel").then((m) => ({
      default: m.QuickLinksPanel,
    })),
  ),
  chores: lazy(() =>
    import("@/pages/_component/HomePanel").then((m) => ({
      default: m.ChoresPanel,
    })),
  ),
  jellyfin_shelf: lazy(() =>
    import("@/pages/_component/JellyfinReadyPanel").then((m) => ({
      default: m.JellyfinReadyPanel,
    })),
  ),
  library_alerts: lazy(() =>
    import("@/pages/_component/LibraryAttentionPanel").then((m) => ({
      default: m.LibraryAttentionPanel,
    })),
  ),
  homeassistant: lazy(() =>
    import("@/pages/_component/HomeAssistantPanel").then((m) => ({
      default: m.HomeAssistantPanel,
    })),
  ),
  habits: lazy(() =>
    import("@/pages/_component/HomePanel").then((m) => ({
      default: m.HabitsPanel,
    })),
  ),
  upcoming: lazy(() =>
    import("@/pages/_component/MediaShelves").then((m) => ({
      default: m.UpcomingShelf,
    })),
  ),
  trackers: lazy(() =>
    import("@/pages/_component/TrackersPanel").then((m) => ({
      default: m.TrackersPanel,
    })),
  ),
  jellyfin_random: lazy(() =>
    import("@/pages/_component/JellyfinRandomPanel").then((m) => ({
      default: m.JellyfinRandomPanel,
    })),
  ),
  system: lazy(() =>
    import("@/pages/_component/system").then((m) => ({
      default: m.SystemPanel,
    })),
  ),
  focus_timer: lazy(() =>
    import("@/pages/_component/FocusTimerPanel").then((m) => ({
      default: m.FocusTimerPanel,
    })),
  ),
  downloads: lazy(() =>
    import("@/pages/_component/DownloadsPanel").then((m) => ({
      default: m.DownloadsPanel,
    })),
  ),
  minecraft_compact: lazy(() =>
    import("@/pages/_component/MinecraftCompactPanel").then((m) => ({
      default: m.MinecraftCompactPanel,
    })),
  ),
  docker: lazy(() =>
    import("@/pages/_component/DockerPanel").then((m) => ({
      default: m.DockerPanel,
    })),
  ),
  rss: lazy(() =>
    import("@/pages/_component/RssStatusPanel").then((m) => ({
      default: m.RssStatusPanel,
    })),
  ),
};
