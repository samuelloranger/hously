/**
 * C411 torrent search and release status API.
 */

import { httpFetch } from '../trackers/httpScraper';
import type {
  C411Session,
  C411TorrentDetail,
} from './types';

export async function fetchTorrentDetail(
  session: C411Session,
  infoHash: string,
): Promise<C411TorrentDetail> {
  const url = new URL(`/api/torrents/${infoHash}`, session.trackerUrl).href;
  const { html, status } = await httpFetch(url, {
    jar: session.jar,
    userAgent: session.userAgent,
    extraHeaders: { Accept: 'application/json' },
  });
  if (status !== 200) throw new Error(`C411: fetch torrent detail failed (${status}) ${html.slice(0, 200)}`);
  return JSON.parse(html);
}
