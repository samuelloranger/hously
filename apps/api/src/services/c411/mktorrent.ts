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
  onProgress?: (pct: number) => void;
}): Promise<void> {
  const torrentBuffer = await new Promise<Buffer>((resolve, reject) => {
    createTorrent(
      opts.contentPath,
      {
        announce: [opts.announceUrl],
        pieceLength: opts.pieceLength,
        onProgress: opts.onProgress
          ? (current: number, total: number) => {
              opts.onProgress!(total > 0 ? Math.round((current / total) * 100) : 0);
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
