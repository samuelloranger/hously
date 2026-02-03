import { getDB } from './db';

export interface QueuedMutation {
  id: number;
  endpoint: string;
  method: string;
  body: string | null;
  headers: Record<string, string>;
  timestamp: number;
  retries: number;
  status: 'pending' | 'processing' | 'failed';
}

/**
 * Add a mutation to the queue for later sync
 * Throws an error if IndexedDB is unavailable
 */
export async function queueMutation(
  endpoint: string,
  method: string,
  body: string | null,
  headers: Record<string, string>
): Promise<number> {
  const db = await getDB();

  if (!db) {
    throw new Error('Cannot queue mutation - IndexedDB unavailable. This may be due to private browsing mode or browser storage settings.');
  }

  const mutation: Omit<QueuedMutation, 'id'> = {
    endpoint,
    method,
    body,
    headers,
    timestamp: Date.now(),
    retries: 0,
    status: 'pending',
  };

  const id = await db.add('mutations', mutation as QueuedMutation);
  return id as number;
}

/**
 * Get all pending mutations
 */
export async function getPendingMutations(): Promise<QueuedMutation[]> {
  const db = await getDB();
  if (!db) {
    return [];
  }

  // Create transaction explicitly to ensure proper lifecycle
  const tx = db.transaction('mutations', 'readonly');
  const index = tx.store.index('by-status');
  const result = await index.getAll('pending');
  await tx.done;
  return result;
}

/**
 * Get all mutations (for debugging/admin)
 */
export async function getAllMutations(): Promise<QueuedMutation[]> {
  const db = await getDB();
  if (!db) {
    return [];
  }
  return db.getAll('mutations');
}

/**
 * Mark mutation as processing
 */
export async function markMutationProcessing(id: number): Promise<void> {
  const db = await getDB();
  if (!db) {
    return;
  }
  const mutation = await db.get('mutations', id);
  if (mutation) {
    await db.put('mutations', {
      ...mutation,
      status: 'processing',
    });
  }
}

/**
 * Mark mutation as failed and increment retry count
 */
export async function markMutationFailed(id: number): Promise<void> {
  const db = await getDB();
  if (!db) {
    return;
  }
  const mutation = await db.get('mutations', id);
  if (mutation) {
    // If retries exceed 5, mark as permanently failed
    const newRetries = mutation.retries + 1;
    await db.put('mutations', {
      ...mutation,
      retries: newRetries,
      status: newRetries >= 5 ? 'failed' : 'pending',
    });
  }
}

/**
 * Remove mutation from queue (successfully synced)
 */
export async function removeMutation(id: number): Promise<void> {
  const db = await getDB();
  if (!db) {
    return;
  }
  await db.delete('mutations', id);
}

/**
 * Clear all mutations (for testing or reset)
 */
export async function clearMutations(): Promise<void> {
  const db = await getDB();
  if (!db) {
    return;
  }
  await db.clear('mutations');
}

/**
 * Get count of pending mutations
 */
export async function getPendingMutationCount(): Promise<number> {
  const db = await getDB();
  if (!db) {
    return 0;
  }

  // Create transaction explicitly to ensure proper lifecycle
  const tx = db.transaction('mutations', 'readonly');
  const index = tx.store.index('by-status');
  const count = await index.count('pending');
  await tx.done;
  return count;
}

