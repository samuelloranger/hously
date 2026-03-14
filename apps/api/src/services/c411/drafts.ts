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

export async function deleteDraft(session: C411Session, id: number): Promise<void> {
  const url = new URL(`/api/user/drafts/${id}`, session.trackerUrl).href;
  const { html, status } = await httpFetch(url, {
    method: 'DELETE',
    jar: session.jar,
    userAgent: session.userAgent,
    extraHeaders: { Accept: 'application/json' },
  });
  if (status !== 200 && status !== 204) throw new Error(`C411: delete draft ${id} failed (${status}) ${html.slice(0, 200)}`);
}

export interface C411PublishResult {
  success: boolean;
  data?: { id: number; infoHash: string; status: string };
  message?: string;
  error?: boolean;
  statusCode?: number;
}

export interface C411PublishPayload {
  torrentBuffer?: Buffer;
  torrentFileName?: string;
  nfoContent?: string;
  nfoFileName?: string;
  title: string;
  categoryId: number;
  subcategoryId: number;
  description?: string;
  options?: Record<string, number | number[]>;
  tmdbData?: any;
}

/**
 * POST multipart/form-data to C411 /api/torrents to publish a torrent.
 */
export async function publishToC411(session: C411Session, payload: C411PublishPayload): Promise<C411PublishResult> {
  const formData = new FormData();

  if (payload.torrentBuffer) {
    const torrentBlob = new Blob([payload.torrentBuffer], { type: 'application/x-bittorrent' });
    formData.set('torrent', torrentBlob, payload.torrentFileName ?? `${payload.title}.torrent`);
  }

  if (payload.nfoContent) {
    const nfoBlob = new Blob([payload.nfoContent], { type: 'text/plain' });
    formData.set('nfo', nfoBlob, payload.nfoFileName ?? `${payload.title}.nfo`);
  }

  formData.set('title', payload.title);
  formData.set('categoryId', String(payload.categoryId));
  formData.set('subcategoryId', String(payload.subcategoryId));

  if (payload.description) {
    formData.set('description', payload.description);
  }

  if (payload.options && Object.keys(payload.options).length > 0) {
    formData.set('options', JSON.stringify(payload.options));
  }

  if (payload.tmdbData) {
    formData.set('tmdbData', JSON.stringify(payload.tmdbData));
  }

  const url = new URL('/api/torrents', session.trackerUrl).href;
  const csrfHeaders = session.jar.csrfHeaders();

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    headers: {
      'User-Agent': session.userAgent,
      Cookie: session.jar.serialize(),
      Accept: '*/*',
      ...csrfHeaders,
    },
  });

  session.jar.absorb(response.headers);
  const text = await response.text();

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      success: false,
      error: true,
      statusCode: response.status,
      message: `Unexpected response (${response.status}): ${text.slice(0, 200)}`,
    };
  }

  if (parsed.error || (!response.ok && !parsed.success)) {
    return {
      success: false,
      error: true,
      statusCode: parsed.statusCode ?? response.status,
      message: parsed.message || `Publish failed (${response.status})`,
    };
  }

  return parsed;
}

/**
 * Publish a draft on C411 by fetching its details and POSTing to /api/torrents.
 */
export async function publishDraft(session: C411Session, draftId: number): Promise<C411PublishResult> {
  const draft = await fetchDraft(session, draftId);

  return publishToC411(session, {
    torrentBuffer: draft.torrentFile?.data ? Buffer.from(draft.torrentFile.data, 'base64') : undefined,
    torrentFileName: draft.torrentFile?.name,
    nfoContent: draft.nfoFile?.data ? Buffer.from(draft.nfoFile.data, 'base64').toString('utf-8') : undefined,
    nfoFileName: draft.nfoFile?.name,
    title: draft.name,
    categoryId: draft.categoryId,
    subcategoryId: draft.subcategoryId,
    description: draft.description ?? undefined,
    options: draft.options,
    tmdbData: draft.tmdbData,
  });
}

export async function downloadPublishedTorrent(
  session: C411Session,
  infoHash: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const url = new URL(`/api/torrents/${infoHash}/download`, session.trackerUrl).href;
  const headers: Record<string, string> = {
    'User-Agent': session.userAgent,
    Cookie: session.jar.serialize(),
    Accept: 'application/x-bittorrent',
  };
  const response = await fetch(url, { headers, redirect: 'follow' });
  session.jar.absorb(response.headers);
  if (!response.ok) throw new Error(`C411: download torrent failed (${response.status})`);

  const disposition = response.headers.get('content-disposition') ?? '';
  const filenameMatch = disposition.match(/filename="?(.+?)"?$/);
  const filename = filenameMatch?.[1] ?? `${infoHash}.torrent`;

  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), filename };
}
