/**
 * Torrent file creation via mktorrent with real-time progress from stdout.
 *
 * mktorrent writes "Hashed N of M pieces.\r" to stdout as it hashes.
 * We pipe stdout, split on \r, and parse piece counts for live progress.
 * onProgress is a proper async callback — DB writes are awaited.
 * Cancel kills the subprocess within the next stdout flush (~100ms).
 */

export class TorrentCancelledError extends Error {
  constructor() {
    super('Torrent creation cancelled');
    this.name = 'TorrentCancelledError';
  }
}

export async function createTorrentFile(opts: {
  announceUrl: string;
  pieceLength: number; // exponent (e.g. 24 = 16 MiB)
  outputPath: string;
  contentPath: string;
  totalContentBytes: number;
  shouldCancel?: () => boolean;
  /** Called on each progress update with pct (0-100), hashed bytes proxy, total bytes, ETA seconds. */
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
    { stdout: 'pipe', stderr: 'ignore' },
  );

  const startedAt = Date.now();
  let buffer = '';
  let cancelled = false;

  for await (const chunk of proc.stdout) {
    if (opts.shouldCancel?.()) {
      cancelled = true;
      proc.kill();
      break;
    }

    buffer += new TextDecoder().decode(chunk);
    const parts = buffer.split('\r');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const m = part.match(/Hashed\s+(\d+)\s+of\s+(\d+)\s+pieces/);
      if (!m || !opts.onProgress) continue;

      const current = Number(m[1]);
      const total = Number(m[2]);
      const pct = total > 0 ? Math.round((current / total) * 100) : 0;
      const elapsed = (Date.now() - startedAt) / 1000;
      const rate = elapsed > 0 ? current / elapsed : 0; // pieces/sec
      const hashedBytes = total > 0 ? Math.round((current / total) * opts.totalContentBytes) : 0;
      const remainingPieces = total - current;
      const eta = rate > 0 && current < total ? Math.round(remainingPieces / rate) : null;

      await opts.onProgress(pct, hashedBytes, opts.totalContentBytes, eta);
    }
  }

  const exitCode = await proc.exited;

  if (cancelled) throw new TorrentCancelledError();
  if (exitCode !== 0) throw new Error(`mktorrent exited with code ${exitCode}`);

  await opts.onProgress?.(100, opts.totalContentBytes, opts.totalContentBytes, 0);
}
