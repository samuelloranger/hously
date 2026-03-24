/**
 * Torrent file creation via mkbrr (6× faster than mktorrent, 12 concurrent workers).
 *
 * mkbrr writes ANSI progress lines to stdout via \r:
 *   "Hashing pieces... [2.7 GiB/s]  62% [=====>  ]"
 * Strip ANSI codes, split on \r, extract percentage → async onProgress callback.
 */

export class TorrentCancelledError extends Error {
  constructor() {
    super('Torrent creation cancelled');
    this.name = 'TorrentCancelledError';
  }
}

const ANSI_RE = /\x1b\[[0-9;]*[mGKHF]/g;

function parsePct(line: string): number | null {
  const clean = line.replace(ANSI_RE, '');
  const m = clean.match(/Hashing pieces\.\.\.[^%]*?(\d+)%/);
  return m ? Number(m[1]) : null;
}

export async function createTorrentFile(opts: {
  announceUrl: string;
  pieceLength: number; // exponent (e.g. 24 = 16 MiB) — mkbrr uses same format
  outputPath: string;
  contentPath: string;
  shouldCancel?: () => boolean;
  /** Called on each percentage update (0-100). */
  onProgress?: (pct: number) => Promise<void>;
}): Promise<void> {
  const proc = Bun.spawn(
    [
      'mkbrr', 'create',
      opts.contentPath,
      '--tracker', opts.announceUrl,
      '--piece-length', String(opts.pieceLength),
      '--output', opts.outputPath,
    ],
    { stdout: 'pipe', stderr: 'ignore' },
  );

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
      const pct = parsePct(part);
      if (pct !== null) await opts.onProgress?.(pct);
    }
  }

  const exitCode = await proc.exited;
  if (cancelled) throw new TorrentCancelledError();
  if (exitCode !== 0) throw new Error(`mkbrr exited with code ${exitCode}`);

  await opts.onProgress?.(100);
}
