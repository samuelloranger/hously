import { scrapeC411 } from './httpC411';
import { scrapeTorr9 } from './httpTorr9';
import type { TrackerPluginConfig, TrackerType } from '../../utils/plugins/types';
import type { FlareSolverrSolution, HttpTrackerStats } from './httpScraper';
import { scrapeLaCale } from './httpLaCale';

export type TrackerScraper = {
  scrape: (config: TrackerPluginConfig, solution?: FlareSolverrSolution) => Promise<HttpTrackerStats>;
  needsFlaresolverr: boolean;
};

export const TRACKER_SCRAPERS: Partial<Record<TrackerType, TrackerScraper>> = {
  c411: { scrape: scrapeC411, needsFlaresolverr: true },
  torr9: { scrape: scrapeTorr9, needsFlaresolverr: true },
  'la-cale': { scrape: scrapeLaCale, needsFlaresolverr: false },
};
