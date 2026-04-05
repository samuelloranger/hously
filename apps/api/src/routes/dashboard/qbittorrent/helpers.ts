import { getQbittorrentPluginConfig } from "../../../services/qbittorrent/config";
import {
  isValidQbittorrentUploadFile,
  normalizeQbittorrentUploadTags,
  parseQbittorrentRid,
  toQbittorrentFileList,
} from "@hously/shared";
import { badRequest } from "../../../errors";

const QBITTORRENT_CONFIG_ERROR =
  "qBittorrent plugin is disabled or not configured";

type MutableStatus = { status?: number };

export async function getQbittorrentConfigOrError(set: MutableStatus) {
  const { enabled, config } = await getQbittorrentPluginConfig();
  if (!enabled || !config) {
    set.status = 400;
    return null;
  }
  return config;
}

export function getQbittorrentConfigErrorResponse() {
  return { error: QBITTORRENT_CONFIG_ERROR };
}

export function applyQbittorrentFetchStatus<T extends { connected: boolean }>(
  set: MutableStatus,
  result: T,
): T {
  if (!result.connected) {
    set.status = 502;
  }
  return result;
}

export function applyQbittorrentMutationStatus<
  T extends { connected: boolean; success: boolean },
>(set: MutableStatus, result: T): T {
  if (!result.connected || !result.success) {
    set.status = 502;
  }
  return result;
}

export function getQbittorrentRid(value: string | undefined) {
  return parseQbittorrentRid(value);
}

export function validateQbittorrentUploadRequest(
  set: MutableStatus,
  payload: { torrents: unknown; tags?: unknown },
  logPrefix: string,
) {
  const inputTorrents = toQbittorrentFileList(payload.torrents);

  if (inputTorrents.length === 0) {
    console.warn(
      `${logPrefix} missing torrent files body.torrents_type=${typeof payload.torrents}`,
    );
    return badRequest(set, "Missing torrent files");
  }

  if (inputTorrents.length > 10) {
    console.warn(
      `${logPrefix} too many torrent files count=${inputTorrents.length}`,
    );
    return badRequest(set, "Too many files (max 10)");
  }

  const torrents: File[] = [];

  for (const [index, torrent] of inputTorrents.entries()) {
    if (!isValidQbittorrentUploadFile(torrent)) {
      console.warn(
        `${logPrefix} invalid torrent payload at index=${index} type=${typeof torrent} ctor=${torrent?.constructor?.name ?? "unknown"}`,
      );
      return badRequest(set, "Invalid torrent file");
    }

    console.log(
      `${logPrefix} torrent index=${index} name="${torrent.name}" size=${torrent.size} type="${torrent.type || "none"}"`,
    );

    if (torrent.size > 5 * 1024 * 1024) {
      set.status = 413;
      console.warn(
        `${logPrefix} torrent too large name="${torrent.name}" size=${torrent.size}`,
      );
      return { error: `Torrent file ${torrent.name} is too large` };
    }

    torrents.push(torrent);
  }

  return {
    torrents,
    tags: normalizeQbittorrentUploadTags(payload.tags),
  };
}
