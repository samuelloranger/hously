# qBittorrent Setup

This guide covers how to configure qBittorrent to notify Hously when a torrent completes, enabling automatic post-processing (hardlink/move to library, MediaFile record creation, SSE push to the UI).

---

## Autorun webhook

### How it works

When a torrent finishes, qBittorrent fires its "Run external program on torrent finished" command with `%I` substituted for the torrent's SHA-1 info hash. Hously's webhook endpoint receives that hash, marks the download complete, and triggers post-processing.

### Why a shell wrapper is required

qBittorrent spawns the autorun program via `QProcess::startDetached()` — **without a shell**. This has two consequences:

- Bare executable names (e.g. `curl`) are not PATH-resolved; the binary must be found via the inherited PATH, which is minimal inside the linuxserver Docker image.
- Shell operators (`>`, `|`, `&&`, redirects) are silently ignored — they are never interpreted.

This is a known upstream behaviour documented in:
- [qBittorrent/qBittorrent#13178](https://github.com/qbittorrent/qBittorrent/issues/13178)
- [qBittorrent/qBittorrent#12367](https://github.com/qbittorrent/qBittorrent/issues/12367)

The fix is to set the autorun field to invoke `/bin/sh` with a script, giving you a real shell environment.

### Why the internal hostname, not the public URL

If qBittorrent runs in `network_mode: "service:vpn"` (i.e. behind Gluetun), all outbound traffic goes through the VPN tunnel. Requests to the public Hously URL would exit via the VPN, traverse Cloudflare, and re-enter the server — introducing latency, a dependency on the VPN being up, and potential Cloudflare blocking of curl user-agents.

Using the internal Docker hostname (e.g. `http://hously:3000`) routes the request directly over the homelab Docker network, which Gluetun allows via `FIREWALL_OUTBOUND_SUBNETS`.

---

## Setup steps

### 1. Create the wrapper script

Create `/config/qb-autorun.sh` inside the qBittorrent container. Since `/config` is a bind-mounted volume, you can write it from the host:

```sh
cat > /path/to/vpn-stack/config/qb-autorun.sh << 'EOF'
#!/bin/sh
# qBittorrent autorun webhook for Hously
# Invoked as: /bin/sh /config/qb-autorun.sh %I
HASH="$1"
curl -s -X POST http://hously:3000/api/webhooks/qbittorrent/completed \
  -H "Authorization: Bearer <QBITTORRENT_WEBHOOK_SECRET>" \
  -H "Content-Type: application/json" \
  -d "{\"hash\":\"$HASH\"}"
EOF
```

Replace `<QBITTORRENT_WEBHOOK_SECRET>` with the value from your `.env` file and `http://hously:3000` with your internal Hously hostname/port if different.

Alternatively, run the setup script which generates the file and sets the preference automatically:

```sh
bun run apps/api/scripts/setup-qb-webhook.ts
# Then copy the generated script into the container:
docker cp apps/api/.generated-qb-autorun.sh qbittorrent:/config/qb-autorun.sh
```

### 2. Set the autorun preference

In qBittorrent's web UI: **Settings → Downloads → Run external program on torrent finished**

Set the field to:

```
/bin/sh /config/qb-autorun.sh %I
```

Or via the API:

```sh
# Inside the qBittorrent container
python3 -c "
import urllib.request, json
url = 'http://localhost:8282/api/v2/app/setPreferences'
prefs = {'autorun_enabled': True, 'autorun_program': '/bin/sh /config/qb-autorun.sh %I'}
data = ('json=' + json.dumps(prefs)).encode()
req = urllib.request.Request(url, data=data, method='POST')
req.add_header('Content-Type', 'application/x-www-form-urlencoded')
with urllib.request.urlopen(req) as r: print(r.status)
"
```

> **Note:** The correct API keys are `autorun_enabled` and `autorun_program`. Older qBittorrent versions used `autorun_on_torrent_finished_enabled` / `autorun_on_torrent_finished_program` — those keys are ignored in current builds.

### 3. Verify

Trigger the script manually with a test hash to confirm connectivity before waiting for a real download:

```sh
docker exec -u abc qbittorrent /bin/sh /config/qb-autorun.sh TESTHASH123
```

Expected Hously response: `{"matched":false,"download_history_id":null}` — `matched: false` is correct since the hash doesn't exist in the database. A real torrent hash returns `matched: true`.

---

## Debugging

Add verbose curl output and a log file to the wrapper script:

```sh
#!/bin/sh
HASH="$1"
LOG=/data/Downloads/autorun-debug.log
echo "=== $(date) hash=$HASH ===" >> "$LOG"
curl -v -X POST http://hously:3000/api/webhooks/qbittorrent/completed \
  -H "Authorization: Bearer <QBITTORRENT_WEBHOOK_SECRET>" \
  -H "Content-Type: application/json" \
  -d "{\"hash\":\"$HASH\"}" >> "$LOG" 2>&1
echo "exit: $?" >> "$LOG"
```

Then watch the log after a torrent completes:

```sh
docker exec qbittorrent tail -f /data/Downloads/autorun-debug.log
```

`/data/Downloads` is used because `/config` may not be writable by the `abc` user depending on host filesystem permissions.

---

## Gluetun firewall configuration

Ensure the Hously Docker network subnet is included in `FIREWALL_OUTBOUND_SUBNETS` in your Gluetun config:

```yaml
environment:
  - FIREWALL_OUTBOUND_SUBNETS=192.168.0.0/16,172.25.0.0/16
```

Without this, outbound connections from qBittorrent (which shares Gluetun's network namespace) to the homelab Docker network are blocked by Gluetun's iptables rules.
