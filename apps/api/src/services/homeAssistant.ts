import { isValidHttpUrl } from "@hously/api/utils/integrations/utils";
import {
  haDomainFromEntityId,
  normalizeHaBaseUrl,
  type HaAllowedDomain,
} from "@hously/api/utils/integrations/homeAssistantUtils";

export type HaStateObject = {
  entity_id: string;
  state: string;
  attributes?: Record<string, unknown>;
};

function haHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function haFetchJson<T>(
  baseUrl: string,
  token: string,
  path: string,
  init?: RequestInit,
): Promise<
  { ok: true; data: T } | { ok: false; status: number; message: string }
> {
  const url = `${normalizeHaBaseUrl(baseUrl)}${path.startsWith("/") ? path : `/${path}`}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        ...haHeaders(token),
        ...init?.headers,
      },
      signal: controller.signal,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network error";
    return { ok: false, status: 502, message };
  } finally {
    clearTimeout(timeout);
  }

  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message:
        text.slice(0, 200) || res.statusText || "Home Assistant request failed",
    };
  }

  try {
    return { ok: true, data: (text ? JSON.parse(text) : null) as T };
  } catch {
    return {
      ok: false,
      status: 502,
      message: "Invalid JSON from Home Assistant",
    };
  }
}

/** GET /api/states — full list (filtered to lights + switches). */
export async function haListDiscoverableEntities(
  baseUrl: string,
  token: string,
): Promise<
  | { ok: true; entities: HaStateObject[] }
  | { ok: false; status: number; message: string }
> {
  const result = await haFetchJson<HaStateObject[]>(
    baseUrl,
    token,
    "/api/states",
  );
  if (!result.ok) return result;
  const entities = result.data.filter(
    (s) => typeof s.entity_id === "string" && haDomainFromEntityId(s.entity_id),
  );
  entities.sort((a, b) => {
    const nameA =
      typeof a.attributes?.friendly_name === "string"
        ? a.attributes.friendly_name
        : a.entity_id;
    const nameB =
      typeof b.attributes?.friendly_name === "string"
        ? b.attributes.friendly_name
        : b.entity_id;
    return nameA.localeCompare(nameB);
  });
  return { ok: true, entities };
}

/** GET /api/states/<entity_id> for each id. */
export async function haGetStatesForEntities(
  baseUrl: string,
  token: string,
  entityIds: string[],
): Promise<
  | { ok: true; states: HaStateObject[] }
  | { ok: false; status: number; message: string }
> {
  const unique = [...new Set(entityIds)].filter((id) =>
    haDomainFromEntityId(id),
  );
  const results = await Promise.all(
    unique.map((id) =>
      haFetchJson<HaStateObject>(
        baseUrl,
        token,
        `/api/states/${encodeURIComponent(id)}`,
      ),
    ),
  );

  const states: HaStateObject[] = [];
  for (const r of results) {
    if (!r.ok) return r;
    states.push(r.data);
  }
  return { ok: true, states };
}

export async function haCallService(
  baseUrl: string,
  token: string,
  domain: HaAllowedDomain,
  service: "turn_on" | "turn_off" | "toggle",
  entityId: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const path = `/api/services/${domain}/${service}`;
  const result = await haFetchJson<unknown>(baseUrl, token, path, {
    method: "POST",
    body: JSON.stringify({ entity_id: entityId }),
  });
  if (!result.ok) return result;
  return { ok: true };
}

export function assertValidHaBaseUrl(url: string): boolean {
  return Boolean(url && isValidHttpUrl(normalizeHaBaseUrl(url)));
}
