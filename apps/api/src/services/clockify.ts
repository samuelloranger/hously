export const CLOCKIFY_API_BASE = 'https://api.clockify.me';

/**
 * Submit a weekly timesheet approval request for the week containing the given start date.
 * POST /v1/workspaces/{workspaceId}/approval-requests
 */
export async function submitApprovalRequest(
  apiKey: string,
  workspaceId: string,
  periodStart: Date,
): Promise<void> {
  const res = await fetch(
    `${CLOCKIFY_API_BASE}/v1/workspaces/${workspaceId}/approval-requests`,
    {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        period: 'WEEKLY',
        periodStart: periodStart.toISOString(),
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Clockify approval request failed: ${res.status} ${text}`);
  }
}
export const CLOCKIFY_PAGE_SIZE = 200;

/**
 * Parse ISO 8601 duration string (e.g. "PT8H30M15S") to seconds
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!match) return 0;
  const hours = parseFloat(match[1] || '0');
  const minutes = parseFloat(match[2] || '0');
  const seconds = parseFloat(match[3] || '0');
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Returns the Monday 00:00:00Z of the current week and now as the end
 */
export function getCurrentWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const thisMonday = new Date(now);
  thisMonday.setUTCDate(now.getUTCDate() - daysSinceMonday);
  thisMonday.setUTCHours(0, 0, 0, 0);

  return { start: thisMonday, end: now };
}
