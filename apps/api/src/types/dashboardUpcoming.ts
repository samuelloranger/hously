export interface ArrPluginStatus {
  radarr_enabled: boolean;
  sonarr_enabled: boolean;
}

export interface DashboardUpcomingProvider {
  id: number;
  name: string;
  logo_url: string;
}

export interface DashboardUpcomingItem {
  id: string;
  title: string;
  media_type: 'movie' | 'tv';
  release_date: string | null;
  poster_url: string | null;
  tmdb_url: string;
  providers: DashboardUpcomingProvider[];
}
