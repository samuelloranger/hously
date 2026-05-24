import type { WebhookHandler } from "./types";
import { asRecord, ensureStrings, firstString, joinValues } from "./utils";

export const handleCrossSeedWebhook: WebhookHandler = (payload) => {
  const extra = asRecord(payload.extra);
  const eventType =
    firstString(extra?.event, payload.event, payload.eventType).toUpperCase() ||
    "RESULTS";
  const searchee = asRecord(extra?.searchee);

  const variables: Record<string, unknown> = {
    event: eventType,
    title: firstString(payload.title),
    body: firstString(payload.body),
    name:
      firstString(
        extra?.name,
        payload.title,
        searchee?.title,
        searchee?.name,
      ) || "Unknown release",
    source: firstString(extra?.source, searchee?.source) || "unknown",
    info_hashes: joinValues(extra?.infoHashes),
    trackers: joinValues(extra?.trackers),
    tracker: firstString(
      Array.isArray(extra?.trackers) ? extra?.trackers[0] : "",
      searchee?.tracker,
    ),
    result: firstString(extra?.result),
    paused: firstString(extra?.paused),
    decisions: joinValues(extra?.decisions),
    category: firstString(searchee?.category),
    client: firstString(searchee?.client),
    save_path: firstString(searchee?.path, searchee?.savePath),
    searchee_source: firstString(searchee?.source),
    client_host: firstString(searchee?.clientHost),
    searchee_trackers: joinValues(searchee?.trackers),
    tags: joinValues(searchee?.tags),
    info_hash: firstString(searchee?.infoHash),
    length: firstString(searchee?.length),
  };

  return {
    event_type: eventType,
    template_variables: ensureStrings(variables),
    original_payload: payload,
  };
};
