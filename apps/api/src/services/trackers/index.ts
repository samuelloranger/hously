import type { Page } from 'playwright';
import { getC411TopPanelStats, loginToC411 } from './c411';
import { getYggTopPanelStats, loginToYgg } from '../ygg';
import { getG3miniTopPanelStats, loginToG3mini } from './g3mini';
import { getTorr9TopPanelStats, loginToTorr9 } from './torr9';
import type { TrackerPluginConfig, TrackerType } from '../../utils/plugins/types';

export type TrackerScraper = {
  login: (page: Page, config: TrackerPluginConfig) => Promise<void>;
  getStats: (page: Page) => Promise<{ uploadedGo: number | null; downloadedGo: number | null; ratio: number | null }>;
};

const yggScraper: TrackerScraper = {
  login: (page, config) =>
    loginToYgg(
      page,
      {
        ...config,
        ygg_url: config.tracker_url,
      },
      { timeoutMs: 30_000, force: true, skipNavigation: true }
    ),
  getStats: getYggTopPanelStats,
};

const c411Scraper: TrackerScraper = {
  login: loginToC411,
  getStats: getC411TopPanelStats,
};

const torr9Scraper: TrackerScraper = {
  login: loginToTorr9,
  getStats: getTorr9TopPanelStats,
};

const g3miniScraper: TrackerScraper = {
  login: loginToG3mini,
  getStats: getG3miniTopPanelStats,
};

export const TRACKER_SCRAPERS: Partial<Record<TrackerType, TrackerScraper>> = {
  ygg: yggScraper,
  c411: c411Scraper,
  torr9: torr9Scraper,
  g3mini: g3miniScraper,
};
