/**
 * Sets up qBittorrent's autorun webhook to notify Hously when a torrent completes.
 *
 * ⚠️  qBittorrent uses QProcess (no shell) to spawn the autorun program. Bare
 * executable names like `curl` are not PATH-resolved and shell operators are
 * silently ignored. The workaround is to point autorun at a shell script:
 *
 *   autorun_program = /bin/sh /config/qb-autorun.sh %I
 *
 * This script writes /config/qb-autorun.sh via the qBittorrent API and sets
 * the autorun preference to invoke it. The shell script uses the internal
 * Docker hostname (http://hously:3000) rather than the public URL so that
 * traffic goes directly over the homelab network instead of through the VPN.
 *
 * See: https://github.com/qbittorrent/qBittorrent/issues/13178
 *
 * Usage: bun run apps/api/scripts/setup-qb-webhook.ts
 */
import { getQbittorrentPluginConfig } from "../src/services/qbittorrent/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const _prisma = new PrismaClient({ adapter });

const qb = await getQbittorrentPluginConfig();
if (!qb.config || !qb.enabled) {
  console.error("qBittorrent not configured or disabled");
  process.exit(1);
}

const secret = process.env.QBITTORRENT_WEBHOOK_SECRET;
if (!secret) {
  console.error("QBITTORRENT_WEBHOOK_SECRET env var is not set");
  process.exit(1);
}

const houslyInternalUrl = process.env.HOUSLY_INTERNAL_URL ?? "http://hously:3000";

console.log("Connecting to:", qb.config.website_url);

// Login
const loginRes = await fetch(`${qb.config.website_url}/api/v2/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    username: qb.config.username,
    password: qb.config.password,
  }),
  redirect: "manual",
});

const cookie = loginRes.headers.get("set-cookie") ?? "";
const sid = cookie.match(/SID=([^;]+)/)?.[1];
if (!sid) {
  console.error("Login failed, status:", loginRes.status);
  process.exit(1);
}
console.log("Logged in, SID acquired");

// Write the wrapper shell script content.
// qBittorrent cannot exec curl directly via QProcess (no shell = no PATH lookup,
// no shell operators). The /bin/sh wrapper gives us a real shell environment.
const scriptContent = `#!/bin/sh
# qBittorrent autorun webhook — invoked by /bin/sh /config/qb-autorun.sh %I
# See: apps/api/scripts/setup-qb-webhook.ts
HASH="$1"
curl -s -X POST ${houslyInternalUrl}/api/webhooks/qbittorrent/completed \\
  -H "Authorization: Bearer ${secret}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"hash\\":\\"$HASH\\"}"
`;

// Write script locally so it can be inspected; the actual file on the
// qBittorrent container must be placed at /config/qb-autorun.sh manually
// (e.g. via docker cp) since the API has no file-upload endpoint.
const localScriptPath = join(import.meta.dir, "../.generated-qb-autorun.sh");
await writeFile(localScriptPath, scriptContent, { mode: 0o755 });
console.log(`Shell script written to: ${localScriptPath}`);
console.log("Copy it into the qBittorrent container:");
console.log("  docker cp", localScriptPath, "qbittorrent:/config/qb-autorun.sh");

// Set the autorun preference to invoke the shell script.
// Correct API keys are `autorun_enabled` and `autorun_program` (not the
// deprecated `autorun_on_torrent_finished_*` variants used in older builds).
const setRes = await fetch(`${qb.config.website_url}/api/v2/app/setPreferences`, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    Cookie: `SID=${sid}`,
  },
  body: new URLSearchParams({
    json: JSON.stringify({
      autorun_enabled: true,
      autorun_program: "/bin/sh /config/qb-autorun.sh %I",
    }),
  }),
});

console.log("setPreferences:", setRes.status, await setRes.text());

// Verify
const prefsRes = await fetch(`${qb.config.website_url}/api/v2/app/preferences`, {
  headers: { Cookie: `SID=${sid}` },
});
const prefs = (await prefsRes.json()) as Record<string, unknown>;
console.log("autorun_enabled:", prefs.autorun_enabled);
console.log("autorun_program:", prefs.autorun_program);

await _prisma.$disconnect();
