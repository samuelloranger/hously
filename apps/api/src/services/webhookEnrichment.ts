import { buildNotificationUrl } from "@hously/shared";
import { getQbittorrentPluginConfig } from "./qbittorrent/config";
import { fetchQbittorrentTorrentTrackers } from "./qbittorrent/trackers";
import { setQbittorrentTorrentTags } from "./qbittorrent/torrents";
import type { WebhookResult } from "./webhookHandlers/types";

export interface TrackerTagMatch {
  tag: string;
  label: string;
  host: string;
  url: string;
}

export interface WebhookNotificationEnrichment {
  template_variables?: Record<string, string>;
  notification_url?: string;
  notification_metadata?: Record<string, unknown>;
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

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function normalizeHash(value: string): string {
  return value.trim().toLowerCase();
}

function buildTorrentDetailUrl(hash: string): string {
  return buildNotificationUrl(`/torrents/${encodeURIComponent(hash)}`);
}

function extractDownloadId(result: WebhookResult): string {
  const payload = result.original_payload as Record<string, unknown>;
  return firstString(
    result.template_variables.download_id,
    payload.downloadId,
    payload.download_id,
  );
}

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

export async function enrichArrWebhookNotification(
  serviceName: string,
  result: WebhookResult,
): Promise<WebhookNotificationEnrichment> {
  if (serviceName !== "radarr" && serviceName !== "sonarr") {
    return {};
  }

  const downloadId = extractDownloadId(result);
  if (!downloadId) {
    return {};
  }

  const hash = normalizeHash(downloadId);
  const torrentUrl = buildTorrentDetailUrl(hash);
  const templateVariables: Record<string, string> = {
    ...result.template_variables,
    qbittorrent_hash: hash,
    qbittorrent_url: torrentUrl,
  };

  const { enabled, config } = await getQbittorrentPluginConfig();
  if (!enabled || !config) {
    return {
      template_variables: templateVariables,
    };
  }

  try {
    const trackersResult = await fetchQbittorrentTorrentTrackers(
      config,
      true,
      hash,
    );
    if (!trackersResult.connected) {
      return {
        template_variables: templateVariables,
        notification_url: torrentUrl,
        notification_metadata: {
          qbittorrent_hash: hash,
          qbittorrent_url: torrentUrl,
        },
      };
    }

    const trackerMatch = trackersResult.trackers
      .map((tracker) => mapTrackerUrlToTag(tracker.url))
      .find((match): match is TrackerTagMatch => Boolean(match));

    if (!trackerMatch) {
      return {
        template_variables: templateVariables,
        notification_url: torrentUrl,
        notification_metadata: {
          qbittorrent_hash: hash,
          qbittorrent_url: torrentUrl,
        },
      };
    }

    templateVariables.tracker_tag = trackerMatch.tag;
    templateVariables.tracker_label = trackerMatch.label;
    templateVariables.tracker_host = trackerMatch.host;
    templateVariables.tracker_url = trackerMatch.url;

    const tagResult = await setQbittorrentTorrentTags(config, true, {
      hash,
      tags: [trackerMatch.tag],
      previous_tags: [],
    });

    if (!tagResult.success) {
      console.warn(
        `[webhook-enrichment] Failed to add qBittorrent tag "${trackerMatch.tag}" for ${serviceName}/${hash}: ${tagResult.error ?? "unknown error"}`,
      );
    }

    return {
      template_variables: templateVariables,
      notification_url: torrentUrl,
      notification_metadata: {
        qbittorrent_hash: hash,
        qbittorrent_url: torrentUrl,
        tracker_tag: trackerMatch.tag,
        tracker_label: trackerMatch.label,
        tracker_host: trackerMatch.host,
        tracker_url: trackerMatch.url,
      },
    };
  } catch (error) {
    console.warn(
      `[webhook-enrichment] Failed to enrich ${serviceName} webhook for hash=${hash}:`,
      error,
    );

    return {
      template_variables: templateVariables,
      notification_url: torrentUrl,
      notification_metadata: {
        qbittorrent_hash: hash,
        qbittorrent_url: torrentUrl,
      },
    };
  }
}
