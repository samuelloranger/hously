/**
 * C411 torrent search and release status API.
 */

import { httpFetch } from '../trackers/httpScraper';
import type {
  C411Session,
  C411Torrent,
  C411TorrentStatus,
  C411TorrentsResponse,
  C411ReleaseStatus,
} from './types';

export type FetchTorrentsOptions = {
  uploader?: string;
  page?: number;
  perPage?: number;
  viewMode?: 'flat' | 'grouped';
  status?: C411TorrentStatus;
};

export async function fetchMyTorrents(
  session: C411Session,
  options: FetchTorrentsOptions = {},
): Promise<C411TorrentsResponse> {
  const { uploader, page = 1, perPage = 100, viewMode = 'flat' } = options;
  const params = new URLSearchParams({ page: String(page), perPage: String(perPage), viewMode });
  if (uploader) params.set('uploader', uploader);

  const url = new URL(`/api/torrents?${params}`, session.trackerUrl).href;
  const { html, status } = await httpFetch(url, {
    jar: session.jar,
    userAgent: session.userAgent,
    extraHeaders: { Accept: 'application/json' },
  });
  if (status !== 200) throw new Error(`C411: fetch torrents failed (${status}) ${html.slice(0, 200)}`);

  const response: C411TorrentsResponse = JSON.parse(html);
  return options.status
    ? { ...response, data: response.data.filter((t) => t.status === options.status) }
    : response;
}

export async function fetchAllMyTorrents(
  session: C411Session,
  uploader?: string,
): Promise<C411Torrent[]> {
  const all: C411Torrent[] = [];
  let page = 1;
  while (true) {
    const response = await fetchMyTorrents(session, { uploader, page, perPage: 100 });
    all.push(...response.data);
    if (page >= response.meta.totalPages) break;
    page++;
  }
  return all;
}

export async function searchTorrents(
  session: C411Session,
  query: string,
  options: { page?: number; perPage?: number } = {},
): Promise<C411TorrentsResponse> {
  const { page = 1, perPage = 25 } = options;
  const params = new URLSearchParams({
    page: String(page),
    perPage: String(perPage),
    sortBy: 'relevance',
    sortOrder: 'desc',
    name: query,
    viewMode: 'flat',
  });

  const url = new URL(`/api/torrents?${params}`, session.trackerUrl).href;
  const { html, status } = await httpFetch(url, {
    jar: session.jar,
    userAgent: session.userAgent,
    extraHeaders: { Accept: 'application/json' },
  });
  if (status !== 200) throw new Error(`C411: search failed (${status}) ${html.slice(0, 200)}`);
  return JSON.parse(html);
}

export async function fetchReleaseStatus(
  session: C411Session,
  params: {
    tmdbId: number;
    tmdbType: string;
    imdbId: string;
    title: string;
    year: number;
  },
): Promise<C411ReleaseStatus> {
  const qs = new URLSearchParams({
    tmdbId: String(params.tmdbId),
    tmdbType: params.tmdbType,
    imdbId: params.imdbId,
    title: params.title,
    year: String(params.year),
  });

  const url = new URL(`/api/slots/release-status?${qs}`, session.trackerUrl).href;
  const { html, status } = await httpFetch(url, {
    jar: session.jar,
    userAgent: session.userAgent,
    extraHeaders: { Accept: 'application/json' },
  });
  if (status !== 200) throw new Error(`C411: release status failed (${status}) ${html.slice(0, 200)}`);
  return JSON.parse(html);
}
