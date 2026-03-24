/**
 * Torrent file creation via create-torrent (with progress support).
 */

import { writeFile } from 'node:fs/promises';
import createTorrent from 'create-torrent';

export async function createTorrentFile(opts: {
  announceUrl: string;
  pieceLength: number;
  outputPath: string;
  contentPath: string;
  /** Called with percentage (0-100), bytes hashed, total bytes, and remaining seconds estimate (null when unknown). */
  onProgress?: (pct: number, hashed: number, total: number, etaSecs: number | null) => void;
}): Promise<void> {
  const startedAt = Date.now();

  const torrentBuffer = await new Promise<Buffer>((resolve, reject) => {
    createTorrent(
      opts.contentPath,
      {
        announce: [opts.announceUrl],
        pieceLength: opts.pieceLength,
        onProgress: opts.onProgress
          ? (current: number, total: number) => {
              const pct = total > 0 ? Math.round((current / total) * 100) : 0;
              let eta: number | null = null;
              if (pct > 0 && pct < 100) {
                const elapsed = (Date.now() - startedAt) / 1000;
                const rate = current / elapsed; // bytes/sec
                eta = rate > 0 ? Math.round((total - current) / rate) : null;
              }
              opts.onProgress!(pct, current, total, eta);
            }
          : undefined,
      },
      (err: Error | null, torrent: Buffer) => {
        if (err) reject(err);
        else resolve(torrent);
      },
    );
  });

  await writeFile(opts.outputPath, torrentBuffer);
}
