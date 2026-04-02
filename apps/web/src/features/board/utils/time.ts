/** Parse strings like "2h 30m", "90m", "1.5h", "2h", "45" (treated as minutes) → minutes */
export function parseTimeInput(value: string): number | null {
  const str = value.trim().toLowerCase();
  if (!str) return null;

  // e.g. "2h 30m" or "2h30m"
  const fullMatch = str.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?$/);
  if (fullMatch) {
    const hours = parseFloat(fullMatch[1]);
    const mins = fullMatch[2] ? parseInt(fullMatch[2], 10) : 0;
    return Math.round(hours * 60) + mins;
  }

  // e.g. "45m" or "45min"
  const minsMatch = str.match(/^(\d+)\s*m(?:in(?:utes?)?)?$/);
  if (minsMatch) return parseInt(minsMatch[1], 10);

  // plain number treated as minutes
  const plainMatch = str.match(/^(\d+)$/);
  if (plainMatch) return parseInt(plainMatch[1], 10);

  return null;
}

/** Format minutes to "Xh Ym" or "Ym" */
export function formatMinutes(mins: number): string {
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
