import { readFileSync, existsSync } from "fs";
import * as crypto from "crypto";

/**
 * Converts a DER-encoded signature (Node crypto default) to raw R+S format (Apple requirement)
 */
export function derToRawApnSignature(signature: Buffer): Buffer {
  let offset = 0;
  if (signature[offset++] !== 0x30) throw new Error("Invalid signature format");
  offset++;

  if (signature[offset++] !== 0x02)
    throw new Error("Invalid signature format (r)");
  const rLen = signature[offset++];
  let r = signature.slice(offset, offset + rLen);
  offset += rLen;

  if (r[0] === 0x00) r = r.slice(1);
  const rPadded = Buffer.alloc(32);
  r.copy(rPadded, 32 - r.length);

  if (signature[offset++] !== 0x02)
    throw new Error("Invalid signature format (s)");
  const sLen = signature[offset++];
  let s = signature.slice(offset, offset + sLen);

  if (s[0] === 0x00) s = s.slice(1);
  const sPadded = Buffer.alloc(32);
  s.copy(sPadded, 32 - s.length);

  return Buffer.concat([rPadded, sPadded]);
}

/** Apple Push Notification Authentication Token (JWT) for APNs HTTP/2 API. */
export function generateApnBearerToken(
  key: string,
  keyId: string,
  teamId: string,
): string {
  const header = { alg: "ES256", kid: keyId };
  const payload = { iss: teamId, iat: Math.floor(Date.now() / 1000) };

  const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
    "base64url",
  );
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const unsignedToken = `${headerBase64}.${payloadBase64}`;

  const signer = crypto.createSign("sha256");
  signer.update(unsignedToken);
  const derSignature = signer.sign(key);
  const rawSignature = derToRawApnSignature(derSignature);

  return `${unsignedToken}.${rawSignature.toString("base64url")}`;
}

export function resolveApnsAuthKeyContent(apnsAuthKeyEnv: string): string {
  let keyContent = apnsAuthKeyEnv;
  if (keyContent.includes("\\n")) keyContent = keyContent.replace(/\\n/g, "\n");
  if (!keyContent.includes("-----BEGIN") && existsSync(keyContent)) {
    keyContent = readFileSync(keyContent, "utf-8");
  }
  return keyContent;
}

export interface ApnSession {
  bearerToken: string;
  baseUrl: string;
  topic: string;
}

/**
 * Resolve APNs credentials from environment, generate a bearer token,
 * and return the session info needed to send pushes. Returns null if
 * credentials are not configured.
 */
export function prepareApnSession(topicOverride?: string): ApnSession | null {
  const {
    APNS_TEAM_ID,
    APNS_KEY_ID,
    APNS_AUTH_KEY,
    APNS_TOPIC,
    APNS_PRODUCTION,
  } = process.env;

  if (!APNS_TEAM_ID || !APNS_KEY_ID || !APNS_AUTH_KEY || !APNS_TOPIC) {
    return null;
  }

  const isProduction = APNS_PRODUCTION === "true";
  const baseUrl = isProduction
    ? "https://api.push.apple.com"
    : "https://api.sandbox.push.apple.com";

  const keyContent = resolveApnsAuthKeyContent(APNS_AUTH_KEY);
  const bearerToken = generateApnBearerToken(
    keyContent,
    APNS_KEY_ID,
    APNS_TEAM_ID,
  );

  return {
    bearerToken,
    baseUrl,
    topic: topicOverride ?? APNS_TOPIC,
  };
}
