/** Domains allowed on the dashboard widget (lights + smart plugs as switches). */
export const HA_ALLOWED_DOMAINS = ['light', 'switch'] as const;
export type HaAllowedDomain = (typeof HA_ALLOWED_DOMAINS)[number];

export function haDomainFromEntityId(entityId: string): HaAllowedDomain | null {
  const dot = entityId.indexOf('.');
  if (dot <= 0) return null;
  const domain = entityId.slice(0, dot);
  return HA_ALLOWED_DOMAINS.includes(domain as HaAllowedDomain) ? (domain as HaAllowedDomain) : null;
}

export function normalizeHaBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

export function haServiceNameForAction(action: 'on' | 'off' | 'toggle'): 'turn_on' | 'turn_off' | 'toggle' {
  if (action === 'on') return 'turn_on';
  if (action === 'off') return 'turn_off';
  return 'toggle';
}
