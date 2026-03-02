import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'fs';
import * as crypto from 'crypto';
import { join } from 'path';

interface LiveActivityStartPayload {
  attributes: {
    habitId: number;
    emoji: string;
    name: string;
    timesPerDay: number;
  };
  contentState: {
    completions: number;
    scheduledTime: number; // Unix timestamp
  };
}

/**
 * Converts a DER-encoded signature to raw R+S format (Apple requirement)
 */
function derToRaw(signature: Buffer): Buffer {
  let offset = 0;
  if (signature[offset++] !== 0x30) throw new Error('Invalid signature format');
  offset++;

  if (signature[offset++] !== 0x02) throw new Error('Invalid signature format (r)');
  const rLen = signature[offset++];
  let r = signature.slice(offset, offset + rLen);
  offset += rLen;

  if (r[0] === 0x00) r = r.slice(1);
  const rPadded = Buffer.alloc(32);
  r.copy(rPadded, 32 - r.length);

  if (signature[offset++] !== 0x02) throw new Error('Invalid signature format (s)');
  const sLen = signature[offset++];
  let s = signature.slice(offset, offset + sLen);

  if (s[0] === 0x00) s = s.slice(1);
  const sPadded = Buffer.alloc(32);
  s.copy(sPadded, 32 - s.length);

  return Buffer.concat([rPadded, sPadded]);
}

function generateApnToken(key: string, keyId: string, teamId: string): string {
  const header = { alg: 'ES256', kid: keyId };
  const payload = { iss: teamId, iat: Math.floor(Date.now() / 1000) };

  const headerBase64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const unsignedToken = `${headerBase64}.${payloadBase64}`;

  const signer = crypto.createSign('sha256');
  signer.update(unsignedToken);
  const derSignature = signer.sign(key);
  const rawSignature = derToRaw(derSignature);

  return `${unsignedToken}.${rawSignature.toString('base64url')}`;
}

/**
 * Send an APNs push-to-start notification to start a Live Activity on iOS.
 * Uses the push-to-start token registered by the app.
 */
export async function sendLiveActivityStartPush(
  tokens: string[],
  payload: LiveActivityStartPayload
): Promise<{ successCount: number; invalidTokens: string[] }> {
  const { APNS_TEAM_ID, APNS_KEY_ID, APNS_AUTH_KEY, APNS_TOPIC, APNS_PRODUCTION } = process.env;

  if (!APNS_TEAM_ID || !APNS_KEY_ID || !APNS_AUTH_KEY || !APNS_TOPIC) {
    console.warn('[LiveActivity] APNs credentials not configured.');
    return { successCount: 0, invalidTokens: [] };
  }

  const isProduction = APNS_PRODUCTION === 'true';
  const baseUrl = isProduction ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com';

  let keyContent = APNS_AUTH_KEY;
  if (keyContent.includes('\\n')) keyContent = keyContent.replace(/\\n/g, '\n');
  if (!keyContent.includes('-----BEGIN') && existsSync(keyContent)) {
    keyContent = readFileSync(keyContent, 'utf-8');
  }

  // The APNs topic for Live Activities is: <bundle-id>.push-type.liveactivity
  const liveActivityTopic = `${APNS_TOPIC}.push-type.liveactivity`;

  const apnsPayload = {
    aps: {
      timestamp: Math.floor(Date.now() / 1000),
      event: 'start',
      'content-state': payload.contentState,
      'attributes-type': 'HabitActivityAttributes',
      attributes: payload.attributes,
      alert: {
        title: `${payload.attributes.emoji} ${payload.attributes.name}`,
        body: 'Time for your habit!',
      },
    },
  };

  try {
    const bearerToken = generateApnToken(keyContent, APNS_KEY_ID, APNS_TEAM_ID);
    const payloadPath = join('/tmp', `apns_la_${Date.now()}.json`);
    writeFileSync(payloadPath, JSON.stringify(apnsPayload));

    let successCount = 0;
    const invalidTokens: string[] = [];

    for (const token of [...new Set(tokens)]) {
      try {
        const proc = Bun.spawnSync([
          'curl',
          '--http2',
          '--silent',
          '--show-error',
          '--header', `apns-topic: ${liveActivityTopic}`,
          '--header', 'apns-push-type: liveactivity',
          '--header', 'apns-priority: 10',
          '--header', `authorization: bearer ${bearerToken}`,
          '--header', 'content-type: application/json',
          '--data-binary', `@${payloadPath}`,
          `${baseUrl}/3/device/${token}`,
        ]);

        const stderr = proc.stderr.toString();
        const stdout = proc.stdout.toString();

        if (proc.success && !stdout.includes('reason')) {
          successCount++;
        } else {
          console.error(`[LiveActivity] APNs failure for ${token.substring(0, 16)}...:`, stdout || stderr);
          if (stdout.includes('BadDeviceToken') || stdout.includes('Unregistered') || stdout.includes('InvalidPushType')) {
            invalidTokens.push(token);
          }
        }
      } catch (e) {
        console.error(`[LiveActivity] Curl error for ${token.substring(0, 16)}...:`, e);
      }
    }

    unlinkSync(payloadPath);
    if (successCount > 0) {
      console.log(`[LiveActivity] Sent ${successCount} push-to-start notifications`);
    }
    return { successCount, invalidTokens };
  } catch (error) {
    console.error('[LiveActivity] APNs Error:', error);
    return { successCount: 0, invalidTokens: [] };
  }
}
