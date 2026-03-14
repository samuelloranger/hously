/**
 * C411 draft management API.
 */

import { httpFetch } from '../trackers/httpScraper';
import type {
  C411Session,
  C411DraftsResponse,
  C411DraftDetail,
  C411DraftDetailResponse,
  C411DraftPayload,
} from './types';

export async function fetchDrafts(session: C411Session): Promise<C411DraftsResponse> {
  const url = new URL('/api/user/drafts', session.trackerUrl).href;
  const { html, status } = await httpFetch(url, {
    jar: session.jar,
    userAgent: session.userAgent,
    extraHeaders: { Accept: 'application/json' },
  });
  if (status !== 200) throw new Error(`C411: fetch drafts failed (${status}) ${html.slice(0, 200)}`);
  return JSON.parse(html);
}

export async function fetchDraft(session: C411Session, id: number): Promise<C411DraftDetail> {
  const url = new URL(`/api/user/drafts/${id}`, session.trackerUrl).href;
  const { html, status } = await httpFetch(url, {
    jar: session.jar,
    userAgent: session.userAgent,
    extraHeaders: { Accept: 'application/json' },
  });
  if (status !== 200) throw new Error(`C411: fetch draft ${id} failed (${status}) ${html.slice(0, 200)}`);
  const response: C411DraftDetailResponse = JSON.parse(html);
  return response.data;
}

export async function createDraft(session: C411Session, payload: C411DraftPayload): Promise<C411DraftDetail> {
  const url = new URL('/api/user/drafts', session.trackerUrl).href;
  const { html, status } = await httpFetch(url, {
    method: 'POST',
    body: JSON.stringify(payload),
    contentType: 'application/json',
    jar: session.jar,
    userAgent: session.userAgent,
    extraHeaders: { Accept: 'application/json' },
  });
  if (status !== 200 && status !== 201) throw new Error(`C411: create draft failed (${status}) ${html.slice(0, 200)}`);
  const response = JSON.parse(html);
  return response.data ?? response;
}

export async function updateDraft(session: C411Session, id: number, payload: C411DraftPayload): Promise<C411DraftDetail> {
  const url = new URL(`/api/user/drafts/${id}`, session.trackerUrl).href;
  const { html, status } = await httpFetch(url, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    contentType: 'application/json',
    jar: session.jar,
    userAgent: session.userAgent,
    extraHeaders: { Accept: 'application/json' },
  });
  if (status !== 200) throw new Error(`C411: update draft ${id} failed (${status}) ${html.slice(0, 200)}`);
  const response = JSON.parse(html);
  return response.data ?? response;
}
