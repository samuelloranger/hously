/**
 * C411 categories and options API.
 */

import { httpFetch } from '../trackers/httpScraper';
import type {
  C411Session,
  C411CategoriesResponse,
  C411CategoryListItem,
  C411CategoryOption,
  C411CategoryOptionsResponse,
} from './types';

export async function fetchCategories(session: C411Session): Promise<C411CategoryListItem[]> {
  const url = new URL('/api/categories', session.trackerUrl).href;
  const { html, status } = await httpFetch(url, {
    jar: session.jar,
    userAgent: session.userAgent,
    extraHeaders: { Accept: 'application/json' },
  });
  if (status !== 200) throw new Error(`C411: fetch categories failed (${status}) ${html.slice(0, 200)}`);
  const response: C411CategoriesResponse = JSON.parse(html);
  return response.data;
}

export async function fetchCategoryOptions(session: C411Session, categoryId: number): Promise<C411CategoryOption[]> {
  const url = new URL(`/api/categories/${categoryId}/options`, session.trackerUrl).href;
  const { html, status } = await httpFetch(url, {
    jar: session.jar,
    userAgent: session.userAgent,
    extraHeaders: { Accept: 'application/json' },
  });
  if (status !== 200) throw new Error(`C411: fetch category options ${categoryId} failed (${status}) ${html.slice(0, 200)}`);
  const response: C411CategoryOptionsResponse = JSON.parse(html);
  return response.data;
}
