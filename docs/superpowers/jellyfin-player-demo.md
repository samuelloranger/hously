# Jellyfin in-browser player (demo)

This document describes configuration for the **Jellyfin HLS demo player** (`/jellyfin/play/$itemId`), which streams directly from your Jellyfin server using a playlist URL returned by the Hously API.

## Jellyfin server

### CORS / browser access

The browser loads the **master playlist and segments from Jellyfin** (the API only returns metadata and the HLS URL; it does not proxy video bytes). Jellyfin must allow your **Hously web origin** in CORS:

- In the Jellyfin dashboard, open **Networking** (or **Dashboard → Networking** depending on version).
- Ensure remote access / known networks allow your Hously site’s origin, and that Jellyfin is not blocking cross-origin requests from that host.

If the network tab shows CORS errors on `master.m3u8` or `.ts` / `.m4s` segment requests, the fix is on the Jellyfin side (or a reverse proxy in front of Jellyfin adding `Access-Control-Allow-Origin` for your Hously origin).

### API key

The integration API key must be allowed to read items and stream. The same key used for the existing Jellyfin integration in Hously settings is sufficient for the demo.

### X-Frame-Options

No change is required for `X-Frame-Options`; the demo does not iframe Jellyfin’s UI.

## Known limitations (demo scope)

- No **Continue watching** / progress sync (no `Sessions/Playing*` reporting).
- No **subtitle** or **secondary audio** selection in the UI.
- The **API key is embedded in the playback URL** returned to the browser (homelab-acceptable for this demo; production would use short-lived signed URLs or a proxy).
- Playback assumes **H.264 / AAC** for the requested transcode profile; some sources may still force transcoding or fail if Jellyfin cannot produce HLS for the item.

## Smoke testing

From the dashboard, **Recently added (Jellyfin)** shows **Play in Hously** on the first card. Use that link, then verify play, pause, seek, volume, and fullscreen in the Vidstack controls.
