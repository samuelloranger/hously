/** Failed cron grab attempts before an item is auto-skipped and admins are notified.
 *  At every-2h cadence this is 12 attempts/day — 24 ≈ 2 days. Manual searches
 *  do not count against this cap and reset the counter on invocation. */
export const MAX_CRON_GRAB_ATTEMPTS = 24;

/** Max .torrent file size when fetched server-side (bytes) */
export const MAX_TORRENT_FILE_BYTES = 15 * 1024 * 1024;

/** qBittorrent category for library movie grabs (save path configured in qB) */
export const QBIT_CATEGORY_HOUSLY_MOVIES = "hously-movies";

/** qBittorrent category for library TV grabs */
export const QBIT_CATEGORY_HOUSLY_SHOWS = "hously-shows";
