import { getDB } from './db';
import type { QueryClient } from '@tanstack/react-query';

/**
 * Persist TanStack Query cache to IndexedDB
 */
export async function persistQueryCache(queryClient: QueryClient): Promise<void> {
  const db = await getDB();
  if (!db) {
    console.warn('Cannot persist query cache - IndexedDB unavailable');
    return;
  }

  const queryCache = queryClient.getQueryCache();

  // Get all queries from cache
  const queries = queryCache.getAll();

  // Store each query in IndexedDB (except notifications which use infinite queries)
  const tx = db.transaction('queries', 'readwrite');
  const promises = queries
    .filter(query => {
      // Skip notifications queries - they use infinite queries which don't
      // persist/restore well
      if (Array.isArray(query.queryKey) && query.queryKey[0] === 'notifications') {
        return false;
      }
      // Skip plugin config queries - settings must always reflect server state.
      if (Array.isArray(query.queryKey) && query.queryKey[0] === 'plugins') {
        return false;
      }
      return true;
    })
    .map(query => {
      const queryKey = JSON.stringify(query.queryKey);
      return tx.store.put({
        queryKey,
        queryHash: query.queryHash,
        data: query.state.data,
        timestamp: Date.now(),
      });
    });

  await Promise.all(promises);
  await tx.done;
}

/**
 * Restore TanStack Query cache from IndexedDB
 * Excludes auth queries which should always be refetched from the server
 */
export async function restoreQueryCache(queryClient: QueryClient): Promise<void> {
  const db = await getDB();
  if (!db) {
    console.warn('Cannot restore query cache - IndexedDB unavailable');
    return;
  }

  const queries = await db.getAll('queries');

  // Restore each query to the cache, but skip certain queries
  for (const storedQuery of queries) {
    try {
      const queryKey = JSON.parse(storedQuery.queryKey);

      // Skip auth queries - they should always be refetched from the server
      // to ensure the session is still valid
      if (Array.isArray(queryKey) && queryKey[0] === 'auth') {
        continue;
      }

      // Skip notifications queries - they use infinite queries which don't
      // persist/restore well, and should always show fresh data
      if (Array.isArray(queryKey) && queryKey[0] === 'notifications') {
        continue;
      }

      // Skip plugin config queries - settings must always reflect server state.
      if (Array.isArray(queryKey) && queryKey[0] === 'plugins') {
        continue;
      }

      queryClient.setQueryData(queryKey, storedQuery.data);
    } catch (error) {
      console.error('Failed to restore query:', storedQuery.queryKey, error);
    }
  }
}

/**
 * Clear persisted query cache
 */
export async function clearQueryCache(): Promise<void> {
  const db = await getDB();
  if (!db) {
    console.warn('Cannot clear query cache - IndexedDB unavailable');
    return;
  }
  await db.clear('queries');
}
