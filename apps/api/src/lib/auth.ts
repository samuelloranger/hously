import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { passkey } from "@better-auth/passkey";
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

type OidcConfig = {
  providerId: string;
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

function mapProfileToUser(profile: Record<string, unknown>) {
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
}

async function loadOidcProviders(): Promise<OidcConfig[]> {
  try {
    const providers = await prisma.oidcProvider.findMany({
      where: { enabled: true },
    });
    return providers
      .map((p) => {
        const clientSecret = p.clientSecret ? decrypt(p.clientSecret) : "";
        if (!clientSecret) return null;
        return {
          providerId: p.slug,
          clientId: p.clientId,
          clientSecret,
          discoveryUrl: p.discoveryUrl,
          scopes: ["openid", "email", "profile"],
          pkce: true as const,
          disableSignUp: true as const,
          mapProfileToUser,
        };
      })
      .filter((c): c is OidcConfig => c !== null);
  } catch (error) {
    console.error("[auth] Failed to load OIDC providers:", error);
    return [];
  }
}

const oidcProviderConfigs: OidcConfig[] = await loadOidcProviders();

export function refreshOidcProviders(): void {
  loadOidcProviders()
    .then((configs) => {
      oidcProviderConfigs.length = 0;
      oidcProviderConfigs.push(...configs);
    })
    .catch((err) => {
      console.error("[auth] Failed to refresh OIDC providers:", err);
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
    genericOAuth({ config: oidcProviderConfigs }),
  ],
  trustedOrigins: [process.env.CORS_ORIGIN || "http://localhost:5173", baseURL],
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
});
