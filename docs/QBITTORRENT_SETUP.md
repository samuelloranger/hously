# qBittorrent setup for Hously

Hously uses qBittorrent as a download backend for library grabs. You need:

1. **Integration credentials** in Settings → Integrations → qBittorrent (URL, username, password).
2. **Autorun webhooks** so Hously knows when torrents are added and completed.

## Automatic webhook setup (recommended)

After saving the integration:

1. Open **Settings → Integrations → qBittorrent**.
2. Click **Configure webhooks**.
3. Hously writes two autorun commands into qBittorrent preferences:
   - **On torrent added** → `POST /api/webhooks/qbittorrent/added?hash=%I`
   - **On torrent finished** → `POST /api/webhooks/qbittorrent/completed?hash=%I`

Use the internal Docker hostname when qBittorrent runs in a VPN/network stack (e.g. `http://hously:3000`). The button probes `hously` on your API port first; override only if your compose service name differs.

Requires qBittorrent **≥ 4.5.0** for the “torrent added” autorun hook.

## Manual setup

If the button fails (qB unreachable from the API, custom networking, etc.), set these in qBittorrent → **Settings → Downloads → Run external program**:

**When torrent finishes:**

```bash
/usr/bin/curl -s -X POST "http://hously:3000/api/webhooks/qbittorrent/completed?hash=%I" -H "Authorization: Bearer YOUR_WEBHOOK_SECRET"
```

**When torrent is added** (qBittorrent ≥ 4.5.0):

```bash
/usr/bin/curl -s -X POST "http://hously:3000/api/webhooks/qbittorrent/added?hash=%I" -H "Authorization: Bearer YOUR_WEBHOOK_SECRET"
```

Replace:

- `http://hously:3000` with the URL qBittorrent can reach (internal Docker hostname preferred).
- `YOUR_WEBHOOK_SECRET` with the secret generated when you first saved the integration (re-save integration if unsure — a new secret is only created on first save).

## What Hously still uses qB for

| Feature                    | How                                                |
| -------------------------- | -------------------------------------------------- |
| Dashboard download speeds  | Polls qB transfer info                             |
| Library grabs              | Adds magnets/files via qB Web API                  |
| Post-processing            | Webhook on completion → hardlink/move into library |
| Early “downloading” status | Webhook on added for Hously-category torrents      |

There is no full qBittorrent client UI in Hously — manage torrents in qBittorrent itself.
