import { openDB, DBSchema, IDBPDatabase } from 'idb';

/**
 * Database schema for offline storage
 */
interface HouslyDB extends DBSchema {
  /**
   * Store for TanStack Query cache
   * Key: query key (stringified)
   * Value: query data
   */
  queries: {
    key: string;
    value: {
      queryKey: string;
      queryHash: string;
      data: unknown;
      timestamp: number;
    };
    indexes: { 'by-timestamp': number };
  };

  /**
   * Store for queued mutations (actions to sync when online)
   * Key: auto-increment ID
   * Value: mutation data
   */
  mutations: {
    key: number;
    value: {
      id: number;
      endpoint: string;
      method: string;
      body: string | null;
      headers: Record<string, string>;
      timestamp: number;
      retries: number;
      status: 'pending' | 'processing' | 'failed';
    };
    indexes: { 'by-status': string; 'by-timestamp': number };
  };

  /**
   * Store for offline metadata
   */
  metadata: {
    key: string;
    value: {
      key: string;
      value: unknown;
    };
  };
}

let dbInstance: IDBPDatabase<HouslyDB> | null = null;
let dbInitFailed = false;

/**
 * Initialize IndexedDB database
 * Returns null if IndexedDB is unavailable (private browsing, quota exceeded, etc.)
 */
export async function initDB(): Promise<IDBPDatabase<HouslyDB> | null> {
  if (dbInstance) {
    return dbInstance;
  }

  // Don't retry if we already know DB init failed
  if (dbInitFailed) {
    return null;
  }

  try {
    dbInstance = await openDB<HouslyDB>('hously-offline', 1, {
      upgrade(db) {
        // Create queries store for TanStack Query persistence
        if (!db.objectStoreNames.contains('queries')) {
          const queryStore = db.createObjectStore('queries', {
            keyPath: 'queryKey',
          });
          queryStore.createIndex('by-timestamp', 'timestamp');
        }

        // Create mutations store for queued actions
        if (!db.objectStoreNames.contains('mutations')) {
          const mutationStore = db.createObjectStore('mutations', {
            keyPath: 'id',
            autoIncrement: true,
          });
          mutationStore.createIndex('by-status', 'status');
          mutationStore.createIndex('by-timestamp', 'timestamp');
        }

        // Create metadata store
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata');
        }
      },
    });

    return dbInstance;
  } catch (error) {
    // IndexedDB unavailable - could be:
    // - Private browsing mode (Firefox/Safari)
    // - Storage quota exceeded
    // - Storage disabled in browser settings
    // - Database corruption
    console.warn('IndexedDB unavailable - offline features disabled:', error);
    dbInitFailed = true;
    return null;
  }
}

/**
 * Get database instance (initializes if needed)
 * Returns null if IndexedDB is unavailable
 */
export async function getDB(): Promise<IDBPDatabase<HouslyDB> | null> {
  if (!dbInstance) {
    return initDB();
  }
  return dbInstance;
}

/**
 * Clear all data from the database
 */
export async function clearDB(): Promise<void> {
  const db = await getDB();
  if (!db) {
    console.warn('Cannot clear database - IndexedDB unavailable');
    return;
  }
  await Promise.all([
    db.clear('queries'),
    db.clear('mutations'),
    db.clear('metadata'),
  ]);
}

