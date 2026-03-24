/**
 * Torrent file creation via mkbrr (6× faster than mktorrent, 12 concurrent workers).
 *
 * mkbrr writes ANSI progress lines to stdout via \r:
 *   "Hashing pieces... [2.7 GiB/s]  62% [=====>  ]"
 * Strip ANSI codes, split on \r, extract percentage + speed → compute ETA.
 */

export class TorrentCancelledError extends Error {
  constructor() {
    super('Torrent creation cancelled');
    this.name = 'TorrentCancelledError';
  }
}

const ANSI_RE = /\x1b\[[0-9;]*[mGKHF]/g;

const SPEED_UNITS: Record<string, number> = {
  'B/s':   1,
  'KiB/s': 1024,
  'MiB/s': 1024 ** 2,
  'GiB/s': 1024 ** 3,
};

function parseLine(line: string): { pct: number; speedBps: number | null } | null {
  const clean = line.replace(ANSI_RE, '');
  const pctMatch = clean.match(/Hashing pieces\.\.\.[^%]*?(\d+)%/);
  if (!pctMatch) return null;

  const pct = Number(pctMatch[1]);

  const speedMatch = clean.match(/\[(\d+\.?\d*)\s*(GiB\/s|MiB\/s|KiB\/s|B\/s)\]/);
  const speedBps = speedMatch
    ? parseFloat(speedMatch[1]) * (SPEED_UNITS[speedMatch[2]] ?? 1)
    : null;

  return { pct, speedBps };
}

export async function createTorrentFile(opts: {
  announceUrl: string;
  pieceLength: number; // exponent (e.g. 24 = 16 MiB) — mkbrr uses same format
  outputPath: string;
  contentPath: string;
  /** Total bytes of content — used to compute ETA from hashing speed. */
  totalBytes?: number;
  shouldCancel?: () => boolean;
  /** Called on each percentage update. etaSeconds is null when speed is unknown. */
  onProgress?: (pct: number, etaSeconds: number | null) => Promise<void>;
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
      const parsed = parseLine(part);
      if (parsed === null) continue;

      let etaSeconds: number | null = null;
      if (parsed.speedBps !== null && opts.totalBytes && parsed.pct < 100) {
        const remainingBytes = opts.totalBytes * (1 - parsed.pct / 100);
        etaSeconds = Math.round(remainingBytes / parsed.speedBps);
      }

      await opts.onProgress?.(parsed.pct, etaSeconds);
    }
  }

  const exitCode = await proc.exited;
  if (cancelled) throw new TorrentCancelledError();
  if (exitCode !== 0) throw new Error(`mkbrr exited with code ${exitCode}`);

  await opts.onProgress?.(100, 0);
}
