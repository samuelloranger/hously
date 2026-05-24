export interface TrackerTagMatch {
  tag: string;
  label: string;
  host: string;
  url: string;
}

const TRACKER_TAG_RULES: Array<{
  matcher: (host: string) => boolean;
  tag: string;
  label: string;
}> = [
  { matcher: (host) => host.includes("c411"), tag: "c411", label: "C411" },
  { matcher: (host) => host.includes("torr9"), tag: "torr9", label: "Torr9" },
  {
    matcher: (host) => host.includes("la-cale") || host.includes("lacale"),
    tag: "La Cale",
    label: "La Cale",
  },
];

export function mapTrackerUrlToTag(url: string): TrackerTagMatch | null {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("** [")) return null;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname
      .trim()
      .toLowerCase()
      .replace(/^www\./, "");
    if (!host) return null;

    const match = TRACKER_TAG_RULES.find((rule) => rule.matcher(host));
    if (!match) return null;

    return {
      tag: match.tag,
      label: match.label,
      host,
      url: trimmed,
    };
  } catch {
    return null;
  }
}
