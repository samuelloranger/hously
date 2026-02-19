import { scrapeC411 } from './httpC411';
import { scrapeTorr9 } from './httpTorr9';
import { scrapeG3mini } from './httpG3mini';
import { scrapeYgg } from './httpYgg';
import type { TrackerPluginConfig, TrackerType } from '../../utils/plugins/types';
import type { FlareSolverrSolution, HttpTrackerStats } from './httpScraper';
import { scrapeLaCale } from './httpLaCale';

export type TrackerScraper = {
  scrape: (config: TrackerPluginConfig, solution?: FlareSolverrSolution) => Promise<HttpTrackerStats>;
  needsFlaresolverr: boolean;
};

export const TRACKER_SCRAPERS: Partial<Record<TrackerType, TrackerScraper>> = {
  ygg: { scrape: scrapeYgg, needsFlaresolverr: true },
  c411: { scrape: scrapeC411, needsFlaresolverr: true },
  torr9: { scrape: scrapeTorr9, needsFlaresolverr: true },
  g3mini: { scrape: scrapeG3mini, needsFlaresolverr: true },
  'la-cale': { scrape: scrapeLaCale, needsFlaresolverr: false },
};
