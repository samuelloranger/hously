import type { WidgetId } from "@hously/shared/constants";
import { ChoresPanel, HabitsPanel } from "@/pages/_component/HomePanel";
import { DownloadsPanel } from "@/pages/_component/DownloadsPanel";
import { FocusTimerPanel } from "@/pages/_component/FocusTimerPanel";
import { HomeAssistantPanel } from "@/pages/_component/HomeAssistantPanel";
import { JellyfinRandomPanel } from "@/pages/_component/JellyfinRandomPanel";
import { JellyfinShelf, UpcomingShelf } from "@/pages/_component/MediaShelves";
import { LibraryAttentionPanel } from "@/pages/_component/LibraryAttentionPanel";
import { LibraryStatsPanel } from "@/pages/_component/LibraryStatsPanel";
import { MinecraftCompactPanel } from "@/pages/_component/MinecraftCompactPanel";
import { QuickLinksPanel } from "@/pages/_component/QuickLinksPanel";
import { RssStatusPanel } from "@/pages/_component/RssStatusPanel";
import { SystemPanel } from "@/pages/_component/system";
import { TrackersPanel } from "@/pages/_component/TrackersPanel";
import { WeatherPanel } from "@/pages/_component/WeatherPanel";

export const WIDGET_COMPONENTS: Record<
  WidgetId,
  React.ComponentType<object>
> = {
  weather: WeatherPanel,
  quick_links: QuickLinksPanel,
  chores: ChoresPanel,
  jellyfin_shelf: JellyfinShelf,
  library_stats: LibraryStatsPanel,
  library_alerts: LibraryAttentionPanel,
  homeassistant: HomeAssistantPanel,
  habits: HabitsPanel,
  upcoming: UpcomingShelf,
  trackers: TrackersPanel,
  jellyfin_random: JellyfinRandomPanel,
  system: SystemPanel,
  focus_timer: FocusTimerPanel,
  downloads: DownloadsPanel,
  minecraft_compact: MinecraftCompactPanel,
  rss: RssStatusPanel,
};
