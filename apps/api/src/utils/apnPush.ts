import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'fs';
import * as crypto from 'crypto';
import { join } from 'path';

interface ApnPushPayload {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: string | null;
  channelId?: string;
  badge?: number;
  contentAvailable?: boolean;
}

/**
 * Converts a DER-encoded signature (Node crypto default) to raw R+S format (Apple requirement)
 */
function derToRaw(signature: Buffer): Buffer {
  // ECDSA DER format: 0x30 <len> 0x02 <len_r> <r> 0x02 <len_s> <s>
  let offset = 0;
  if (signature[offset++] !== 0x30) throw new Error('Invalid signature format');
  offset++; // skip total length

  if (signature[offset++] !== 0x02) throw new Error('Invalid signature format (r)');
  const rLen = signature[offset++];
  let r = signature.slice(offset, offset + rLen);
  offset += rLen;

  // Remove leading zero if present
  if (r[0] === 0x00) r = r.slice(1);
  // Pad to 32 bytes
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

/**
 * Generates an Apple Push Notification Authentication Token (JWT)
 */
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

export async function sendApnNotifications(
  tokens: string[],
  payload: ApnPushPayload
): Promise<{ successCount: number; invalidTokens: string[] }> {
  const { APNS_TEAM_ID, APNS_KEY_ID, APNS_AUTH_KEY, APNS_TOPIC, APNS_PRODUCTION } = process.env;

  if (!APNS_TEAM_ID || !APNS_KEY_ID || !APNS_AUTH_KEY || !APNS_TOPIC) {
    console.warn('APNs credentials not configured.');
    return { successCount: 0, invalidTokens: [] };
  }

  const isProduction = APNS_PRODUCTION === 'true';
  const baseUrl = isProduction ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com';

  let keyContent = APNS_AUTH_KEY;
  if (keyContent.includes('\\n')) keyContent = keyContent.replace(/\\n/g, '\n');
  if (!keyContent.includes('-----BEGIN') && existsSync(keyContent)) {
    keyContent = readFileSync(keyContent, 'utf-8');
  }

  try {
    const bearerToken = generateApnToken(keyContent, APNS_KEY_ID, APNS_TEAM_ID);
    const aps: Record<string, unknown> = {
      badge: payload.badge,
      'thread-id': payload.channelId,
      'content-available': payload.contentAvailable ? 1 : undefined,
    };

    if (payload.title || payload.body) {
      aps.alert = { title: payload.title, body: payload.body };
    }

    const resolvedSound = payload.sound === null
      ? undefined
      : (payload.sound ?? (payload.contentAvailable ? undefined : 'default'));
    if (resolvedSound) {
      aps.sound = resolvedSound;
    }

    const apnsPayload = {
      aps,
      ...payload.data,
    };

    const payloadPath = join('/tmp', `apns_${Date.now()}.json`);
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
          '--header',
          `apns-topic: ${APNS_TOPIC}`,
          '--header',
          `apns-push-type: ${payload.contentAvailable ? 'background' : 'alert'}`,
          '--header',
          `apns-priority: ${payload.contentAvailable ? '5' : '10'}`,
          '--header',
          `authorization: bearer ${bearerToken}`,
          '--data-binary',
          `@${payloadPath}`,
          `${baseUrl}/3/device/${token}`,
        ]);

        const stderr = proc.stderr.toString();
        const stdout = proc.stdout.toString();

        if (proc.success && !stdout.includes('reason')) {
          successCount++;
        } else {
          console.error(`APNs failure for ${token}:`, stdout || stderr);
          if (stdout.includes('BadDeviceToken') || stdout.includes('Unregistered')) {
            invalidTokens.push(token);
          }
        }
      } catch (e) {
        console.error(`Curl error for ${token}:`, e);
      }
    }

    unlinkSync(payloadPath);
    if (successCount > 0) console.log(`Sent ${successCount} APNs notifications via curl`);
    return { successCount, invalidTokens };
  } catch (error) {
    console.error('APNs Error:', error);
    return { successCount: 0, invalidTokens: [] };
  }
}
