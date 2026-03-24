/**
 * Torrent file creation via mktorrent (C binary) with progress polling.
 *
 * Progress is derived by watching the output .torrent file grow.
 * The piece-hash section expands linearly as mktorrent hashes each piece,
 * so file_size / expected_size is a reliable progress proxy.
 * mktorrent polls run on the real event loop, so DB writes are awaited.
 */

import { stat } from 'node:fs/promises';

export class TorrentCancelledError extends Error {
  constructor() {
    super('Torrent creation cancelled');
    this.name = 'TorrentCancelledError';
  }
}

function estimateTorrentFileSize(totalContentBytes: number, pieceLengthExp: number): number {
  const pieceLength = 1 << pieceLengthExp;
  const numPieces = Math.ceil(totalContentBytes / pieceLength);
  // 20 bytes SHA1 per piece + generous fixed overhead for bencoded metadata
  return numPieces * 20 + 4096;
}

export async function createTorrentFile(opts: {
  announceUrl: string;
  pieceLength: number; // exponent (e.g. 24 = 16 MiB)
  outputPath: string;
  contentPath: string;
  totalContentBytes: number;
  shouldCancel?: () => boolean;
  /** Called every ~1s with pct (0-100), bytes hashed proxy, total bytes, and ETA seconds. */
  onProgress?: (pct: number, hashed: number, total: number, etaSecs: number | null) => Promise<void>;
}): Promise<void> {
  const proc = Bun.spawn(
    [
      'mktorrent',
      '-a', opts.announceUrl,
      '-l', String(opts.pieceLength),
      '-o', opts.outputPath,
      opts.contentPath,
    ],
    { stdout: 'ignore', stderr: 'ignore' },
  );

  const expectedSize = estimateTorrentFileSize(opts.totalContentBytes, opts.pieceLength);
  const startedAt = Date.now();
  let cancelled = false;

  const poll = setInterval(async () => {
    if (opts.shouldCancel?.()) {
      cancelled = true;
      proc.kill();
      clearInterval(poll);
      return;
    }

    if (!opts.onProgress) return;
    try {
      const { size } = await stat(opts.outputPath);
      if (size === 0) return;
      const pct = Math.min(99, Math.round((size / expectedSize) * 100));
      const hashed = Math.round((pct / 100) * opts.totalContentBytes);
      const elapsed = (Date.now() - startedAt) / 1000;
      const rate = hashed / elapsed;
      const eta = rate > 0 && pct > 0 ? Math.round((opts.totalContentBytes - hashed) / rate) : null;
      await opts.onProgress(pct, hashed, opts.totalContentBytes, eta);
    } catch {
      // file doesn't exist yet or proc already done — skip
    }
  }, 1000);

  try {
    const exitCode = await proc.exited;
    if (cancelled) throw new TorrentCancelledError();
    if (exitCode !== 0) throw new Error(`mktorrent exited with code ${exitCode}`);
    await opts.onProgress?.(100, opts.totalContentBytes, opts.totalContentBytes, 0);
  } finally {
    clearInterval(poll);
  }
}
