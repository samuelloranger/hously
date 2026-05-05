import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { passkey } from "@better-auth/passkey";
import type { Prisma } from "@prisma/client";
import { prisma } from "@hously/api/db";
import { getBaseUrl } from "@hously/api/config";
import { decrypt } from "@hously/api/services/crypto";
import { sendPasswordResetEmail } from "@hously/api/services/emailService";
import { hashPassword, verifyPassword } from "@hously/api/utils/password";

const authSecret =
  process.env.BETTER_AUTH_SECRET || process.env.SECRET_KEY || "";
if (!authSecret) {
  console.error(
    "[hously] BETTER_AUTH_SECRET is not set. Generate one with:\n" +
      "  openssl rand -base64 32\n" +
      "and add it to your .env file.",
  );
  process.exit(1);
}

type AuthentikConfig = {
  providerId: "authentik";
  clientId: string;
  clientSecret: string;
  discoveryUrl: string;
  scopes: string[];
  pkce: true;
  disableSignUp: true;
  mapProfileToUser: (profile: Record<string, unknown>) => {
    name: string;
    firstName: string;
    lastName: string;
  };
};

function isRecord(value: Prisma.JsonValue | null): value is Prisma.JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function loadAuthentikConfig(): Promise<AuthentikConfig | null> {
  try {
    const integration = await prisma.integration.findFirst({
      where: { type: "authentik", enabled: true },
      select: { config: true },
    });
    if (!integration?.config || !isRecord(integration.config)) return null;

    const issuerUrl =
      typeof integration.config.issuer_url === "string"
        ? integration.config.issuer_url.replace(/\/$/, "")
        : "";
    const clientId =
      typeof integration.config.client_id === "string"
        ? integration.config.client_id
        : "";
    const encryptedSecret =
      typeof integration.config.client_secret === "string"
        ? integration.config.client_secret
        : "";
    const clientSecret = encryptedSecret ? decrypt(encryptedSecret) : "";

    if (!issuerUrl || !clientId || !clientSecret) return null;

    return {
      providerId: "authentik",
      clientId,
      clientSecret,
      discoveryUrl: `${issuerUrl}/.well-known/openid-configuration`,
      scopes: ["openid", "email", "profile"],
      pkce: true,
      disableSignUp: true as const,
      mapProfileToUser: (profile) => {
        const name = typeof profile.name === "string" ? profile.name : "";
        const firstName =
          typeof profile.given_name === "string"
            ? profile.given_name
            : name.split(" ")[0] || "";
        const lastName =
          typeof profile.family_name === "string"
            ? profile.family_name
            : name.split(" ").slice(1).join(" ");
        return {
          name: name || [firstName, lastName].filter(Boolean).join(" "),
          firstName,
          lastName,
        };
      },
    };
  } catch (error) {
    console.error("[auth] Failed to load Authentik integration config:", error);
    return null;
  }
}

const initialAuthentikConfig = await loadAuthentikConfig();
const authentikConfigs: AuthentikConfig[] = initialAuthentikConfig
  ? [initialAuthentikConfig]
  : [];

export function refreshAuthentikConfig(): void {
  loadAuthentikConfig()
    .then((config) => {
      authentikConfigs.length = 0;
      if (config) authentikConfigs.push(config);
    })
    .catch((err) => {
      console.error("[auth] Failed to refresh Authentik config:", err);
    });
}

const baseURL = getBaseUrl();

export const auth = betterAuth({
  appName: "Hously",
  baseURL,
  secret: authSecret,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
    usePlural: false,
    transaction: true,
  }),
  user: {
    modelName: "User",
    fields: {
      image: "avatarUrl",
    },
    additionalFields: {
      firstName: { type: "string", required: false, fieldName: "firstName" },
      lastName: { type: "string", required: false, fieldName: "lastName" },
      isAdmin: { type: "boolean", required: false, fieldName: "isAdmin" },
      locale: { type: "string", required: false, fieldName: "locale" },
    },
  },
  session: {
    modelName: "BaSession",
    expiresIn: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  account: {
    modelName: "BaAccount",
  },
  verification: {
    modelName: "BaVerification",
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const locale =
        typeof (user as unknown as { locale?: unknown }).locale === "string"
          ? (user as unknown as { locale: string }).locale
          : "en";
      await sendPasswordResetEmail(user.email, url, locale);
    },
    resetPasswordTokenExpiresIn: 60 * 60,
    password: {
      hash: hashPassword,
      verify: ({ hash, password }) => verifyPassword(password, hash),
    },
  },
  plugins: [
    passkey({
      rpID: process.env.WEBAUTHN_RP_ID || new URL(baseURL).hostname,
      rpName: process.env.WEBAUTHN_RP_NAME || "Hously",
      origin: baseURL,
      schema: {
        passkey: { modelName: "BaPasskey" },
      },
    }),
    genericOAuth({ config: authentikConfigs }),
  ],
  trustedOrigins: [process.env.CORS_ORIGIN || "http://localhost:5173", baseURL],
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
});
