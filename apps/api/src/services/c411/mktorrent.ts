/**
 * Torrent file creation via mktorrent.
 */

export async function createTorrent(opts: {
  announceUrl: string;
  pieceLength: number;
  outputPath: string;
  contentPath: string;
}): Promise<void> {
  const proc = Bun.spawn(
    ['mktorrent', '-a', opts.announceUrl, '-l', String(opts.pieceLength), '-o', opts.outputPath, opts.contentPath],
    { stdout: 'pipe', stderr: 'pipe' },
  );
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`mktorrent failed (exit ${exitCode}): ${stderr}`);
  }
}
