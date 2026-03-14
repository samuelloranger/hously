/**
 * Shared utilities for C411 release preparation.
 */

export function formatSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} Go`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(2)} Mo`;
  return `${(bytes / 1024).toFixed(2)} Ko`;
}

export function calcPieceLength(sizeBytes: number): number {
  if (sizeBytes < 536_870_912) return 20;
  if (sizeBytes < 1_073_741_824) return 21;
  if (sizeBytes < 4_294_967_296) return 22;
  if (sizeBytes < 8_589_934_592) return 23;
  return 24;
}
