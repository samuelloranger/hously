export function ensureStrings(
  obj: Record<string, unknown>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = value == null ? "" : String(value);
  }
  return result;
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  return value as Record<string, unknown>;
}

export function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }

    if (typeof value === "boolean") {
      return String(value);
    }
  }

  return "";
}

export function joinValues(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry))
      .filter(Boolean)
      .join(", ");
  }

  return typeof value === "string" ? value : "";
}

export function formatTicks(value: unknown): string {
  const ticks = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(ticks) || ticks <= 0) return "";

  const totalSeconds = Math.floor(ticks / 10_000_000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function normalizeJellyfinEventType(eventType: string): string {
  const mappings: Record<string, string> = {
    ItemRemoved: "ItemDeleted",
    UserAdded: "UserCreated",
  };

  return mappings[eventType] || eventType;
}
