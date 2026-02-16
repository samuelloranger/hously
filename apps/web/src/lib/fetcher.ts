import { createFetcher, type Fetcher } from '@hously/shared';
import { fetchApi } from './api';

export const webFetcher: Fetcher = createFetcher(
  (endpoint, options) =>
    fetchApi(endpoint, {
      method: options.method,
      headers: options.headers,
      body: options.body as BodyInit | null | undefined,
    }),
  { serializeJsonBody: true }
);
