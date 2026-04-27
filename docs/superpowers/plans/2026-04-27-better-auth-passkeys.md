# Passkey (WebAuthn) Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add passkey (WebAuthn) support to Hously — users can register passkeys from their profile settings and use them to sign in, while the existing email/password flow is preserved unchanged.

**Architecture:** `@simplewebauthn/server` handles all WebAuthn ceremony logic on the API side; challenges are stored ephemerally in Redis (60 s TTL) using the existing `cache.ts` service; a new `webauthn_credentials` table stores registered credentials per user. The existing JWT/cookie session mechanism (httpOnly cookie + refresh token) is reused verbatim after a successful passkey authentication — no changes to downstream auth middleware.

**Tech Stack:** `@simplewebauthn/server` v13 (API), `@simplewebauthn/browser` v13 (web), Prisma (PostgreSQL), Bun RedisClient via `cache.ts`, Elysia route plugin.

---

## File Map

### New files

| File                                                         | Purpose                                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `apps/api/src/routes/passkey.ts`                             | 4 WebAuthn routes (register/options, register/verify, authenticate/options, authenticate/verify)  |
| `apps/web/src/lib/auth/usePasskey.ts`                        | `usePasskeyRegister`, `usePasskeyAuthenticate`, `usePasskeyCredentials`, `useDeletePasskey` hooks |
| `apps/web/src/pages/settings/_component/PasskeysSection.tsx` | UI component for managing passkeys in Profile tab                                                 |
| `apps/api/test/passkey.test.ts`                              | Integration tests for passkey routes                                                              |

### Modified files

| File                                                    | Change                                                               |
| ------------------------------------------------------- | -------------------------------------------------------------------- |
| `apps/api/prisma/schema.prisma`                         | Add `WebAuthnCredential` model; make `User.passwordHash` nullable    |
| `apps/api/src/config.ts`                                | Add `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN` env vars |
| `.env.example`                                          | Document the 3 new env vars                                          |
| `apps/api/src/auth.ts`                                  | Guard password login when `passwordHash` is null                     |
| `apps/api/src/index.ts`                                 | Compose `passkeyRoutes`                                              |
| `apps/api/src/utils/mappers.ts`                         | Add `has_passkey` field to `mapUser`                                 |
| `apps/web/src/lib/endpoints/auth.ts`                    | Add `PASSKEY_*` endpoint constants                                   |
| `apps/web/src/pages/login/_component/LoginForm.tsx`     | Add "Sign in with a passkey" button                                  |
| `apps/web/src/pages/settings/_component/ProfileTab.tsx` | Render `<PasskeysSection />`                                         |
| `apps/shared/src/types/user.ts`                         | Add `has_passkey?: boolean` to `User`                                |

---

## Task 1: Prisma schema — add WebAuthnCredential model

**Files:**

- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Make `passwordHash` nullable on `User`**

In `schema.prisma`, change:

```prisma
passwordHash    String    @map("password_hash")
```

to:

```prisma
passwordHash    String?   @map("password_hash")
```

Also add the relation field to `User` (inside the `User` model, alongside the other relation fields):

```prisma
passkeyCredentials WebAuthnCredential[]
```

- [ ] **Step 2: Add `WebAuthnCredential` model**

Append to `schema.prisma` (after the `RefreshToken` model):

```prisma
model WebAuthnCredential {
  id           Int      @id @default(autoincrement())
  userId       Int      @map("user_id")
  credentialId String   @unique @map("credential_id")
  publicKey    Bytes    @map("public_key")
  counter      BigInt   @default(0)
  transports   String[] @default([])
  deviceType   String   @default("singleDevice") @map("device_type")
  backedUp     Boolean  @default(false) @map("backed_up")
  name         String?
  createdAt    DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId], map: "ix_webauthn_credentials_user_id")
  @@map("webauthn_credentials")
}
```

- [ ] **Step 3: Generate and apply migration**

```bash
# From repo root
make migrate-dev
# When prompted, name the migration: add_webauthn_credentials
```

Expected output includes: `✓ Generated Prisma Client` and migration file created in `apps/api/prisma/migrations/`.

- [ ] **Step 4: Verify Prisma client regenerated**

```bash
cd apps/api && bun run -e "import { prisma } from './src/db'; console.log('ok');"
```

Expected: prints `ok` with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(db): add webauthn_credentials table, make passwordHash nullable"
```

---

## Task 2: Config — add WebAuthn env vars

**Files:**

- Modify: `apps/api/src/config.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add env vars to config schema**

In `apps/api/src/config.ts`, inside the `envSchema` object add these three fields after the existing `SECRET_KEY` line:

```typescript
WEBAUTHN_RP_ID: z.string().optional(),
WEBAUTHN_RP_NAME: z.string().optional().default("Hously"),
WEBAUTHN_ORIGIN: z.string().optional(),
```

- [ ] **Step 2: Export a `getWebAuthnConfig` helper**

Add this function to `apps/api/src/config.ts` (at the bottom, after the existing `getRedisUrl` or similar helpers):

```typescript
export function getWebAuthnConfig(): {
  rpID: string;
  rpName: string;
  origin: string;
} {
  const baseUrl = config.BASE_URL;
  const parsedBase = new URL(baseUrl);
  return {
    rpID: config.WEBAUTHN_RP_ID ?? parsedBase.hostname,
    rpName: config.WEBAUTHN_RP_NAME,
    origin: config.WEBAUTHN_ORIGIN ?? baseUrl,
  };
}
```

- [ ] **Step 3: Document new vars in `.env.example`**

After the `SECRET_KEY=` line in `.env.example`, add:

```
# WebAuthn / Passkey (optional — defaults derived from BASE_URL)
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_NAME=Hously
WEBAUTHN_ORIGIN=http://localhost:3000
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/config.ts .env.example
git commit -m "feat(config): add WebAuthn RP config env vars"
```

---

## Task 3: Install dependencies

**Files:** `apps/api/package.json`, `apps/web/package.json`

- [ ] **Step 1: Install server-side library**

```bash
cd apps/api && bun add @simplewebauthn/server
```

Expected: `@simplewebauthn/server` appears in `apps/api/package.json` dependencies.

- [ ] **Step 2: Install browser-side library**

```bash
cd apps/web && bun add @simplewebauthn/browser
```

Expected: `@simplewebauthn/browser` appears in `apps/web/package.json` dependencies.

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json apps/web/package.json bun.lock
git commit -m "feat(deps): add @simplewebauthn/server and @simplewebauthn/browser"
```

---

## Task 4: Guard password login for passwordless accounts

**Files:**

- Modify: `apps/api/src/auth.ts`

The login route currently calls `verifyPassword(password, user.passwordHash)` without checking if `passwordHash` is null. After making the field nullable, this will crash for passkey-only users.

- [ ] **Step 1: Write failing test**

Create `apps/api/test/passkey.test.ts`:

```typescript
import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { app } from "../src/index";
import { prisma } from "../src/db";

const hasDb = !!process.env.DATABASE_URL;

describe("Passkey routes", () => {
  const passkeyOnlyEmail = "passkey-only@example.com";

  beforeAll(async () => {
    if (!hasDb) return;
    await prisma.user.deleteMany({ where: { email: passkeyOnlyEmail } });
    await prisma.user.create({
      data: {
        email: passkeyOnlyEmail,
        passwordHash: null,
        isAdmin: false,
        createdAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    if (!hasDb) return;
    await prisma.user.deleteMany({ where: { email: passkeyOnlyEmail } });
  });

  it("rejects password login for passkey-only account", async () => {
    if (!hasDb) return;
    const res = await app.handle(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: passkeyOnlyEmail, password: "anything" }),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("passkey");
  });

  it("GET /api/auth/passkey/authenticate/options returns 200 with challenge", async () => {
    if (!hasDb) return;
    const res = await app.handle(
      new Request("http://localhost/api/auth/passkey/authenticate/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.challenge).toBe("string");
    expect(body.challenge.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/api && bun test test/passkey.test.ts
```

Expected: `rejects password login for passkey-only account` FAILS because the route currently crashes on null passwordHash.

- [ ] **Step 3: Add null guard in login route**

In `apps/api/src/auth.ts`, inside the `/login` handler, add a null check before the `verifyPassword` call:

Replace:

```typescript
try {
  const isValid = await verifyPassword(
    password,
    user.passwordHash,
  );
```

With:

```typescript
if (!user.passwordHash) {
  set.status = 400;
  return { success: false, error: "This account uses passkey authentication. Please sign in with your passkey." };
}

try {
  const isValid = await verifyPassword(
    password,
    user.passwordHash,
  );
```

- [ ] **Step 4: Run test — expect first case to pass, second to fail (route doesn't exist yet)**

```bash
cd apps/api && bun test test/passkey.test.ts
```

Expected: `rejects password login for passkey-only account` PASSES. `GET /api/auth/passkey/authenticate/options returns 200` FAILS with 404.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth.ts apps/api/test/passkey.test.ts
git commit -m "feat(auth): guard password login for passkey-only accounts"
```

---

## Task 5: Passkey routes

**Files:**

- Create: `apps/api/src/routes/passkey.ts`

This file implements 4 routes. Registration routes require an authenticated user (uses `.use(auth)`). Authentication routes are public (no auth needed — that's the point).

> ⚠️ **Steps 1 and 2 are shown for illustration only — they describe approaches that don't work. Skip directly to Step 3 for the correct implementation.**

- [ ] **Step 1: ~~Create `apps/api/src/routes/passkey.ts`~~ (SKIP — see Step 3)**

```typescript
import { Elysia, t } from "elysia";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { prisma } from "../db";
import { requireUser } from "../middleware/auth";
import { getWebAuthnConfig } from "../config";
import { getJsonCache, setJsonCache, deleteCache } from "../services/cache";

const CHALLENGE_TTL = 60; // seconds

function regChallengeKey(userId: number) {
  return `webauthn:reg-challenge:${userId}`;
}

function authChallengeKey(challenge: string) {
  return `webauthn:auth-challenge:${challenge}`;
}

export const passkeyRoutes = new Elysia({ prefix: "/api/auth/passkey" })
  // ── Registration (requires existing session) ────────────────────────────────
  .use(requireUser)
  .post("/register/options", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const { rpID, rpName } = getWebAuthnConfig();

    const existing = await prisma.webAuthnCredential.findMany({
      where: { userId: user.id },
      select: { credentialId: true, transports: true },
    });

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.email,
      userID: isoBase64URL.fromBuffer(Buffer.from(user.id.toString(), "utf8")),
      excludeCredentials: existing.map((c) => ({
        id: c.credentialId,
        transports: c.transports as AuthenticatorTransport[],
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    await setJsonCache(
      regChallengeKey(user.id),
      options.challenge,
      CHALLENGE_TTL,
    );

    return options;
  })
  .post(
    "/register/verify",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { rpID, origin } = getWebAuthnConfig();

      const expectedChallenge = await getJsonCache<string>(
        regChallengeKey(user.id),
      );
      if (!expectedChallenge) {
        set.status = 400;
        return { error: "Challenge expired or not found. Please try again." };
      }

      let verification;
      try {
        verification = await verifyRegistrationResponse({
          response: body as Parameters<
            typeof verifyRegistrationResponse
          >[0]["response"],
          expectedChallenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
        });
      } catch (err) {
        set.status = 400;
        return { error: "Passkey verification failed." };
      }

      if (!verification.verified || !verification.registrationInfo) {
        set.status = 400;
        return { error: "Passkey verification failed." };
      }

      await deleteCache(regChallengeKey(user.id));

      const { credential, credentialDeviceType, credentialBackedUp } =
        verification.registrationInfo;

      await prisma.webAuthnCredential.create({
        data: {
          userId: user.id,
          credentialId: credential.id,
          publicKey: Buffer.from(credential.publicKey),
          counter: BigInt(credential.counter),
          transports: (credential.transports ?? []) as string[],
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          name: body.name ?? null,
        },
      });

      return { verified: true };
    },
    {
      body: t.Object({
        id: t.String(),
        rawId: t.String(),
        response: t.Object({
          clientDataJSON: t.String(),
          attestationObject: t.String(),
          transports: t.Optional(t.Array(t.String())),
        }),
        clientExtensionResults: t.Optional(t.Any()),
        type: t.String(),
        name: t.Optional(t.String()),
      }),
    },
  )
  // ── Authentication (public) ─────────────────────────────────────────────────
  .post("/authenticate/options", async ({ set }) => {
    const { rpID } = getWebAuthnConfig();

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
    });

    await setJsonCache(
      authChallengeKey(options.challenge),
      options.challenge,
      CHALLENGE_TTL,
    );

    return options;
  })
  .post(
    "/authenticate/verify",
    async ({ body, set, jwt, cookie: { auth } }) => {
      const { rpID, origin } = getWebAuthnConfig();

      const credential = await prisma.webAuthnCredential.findUnique({
        where: { credentialId: body.id },
        include: { user: true },
      });

      if (!credential) {
        set.status = 401;
        return { error: "Passkey not found." };
      }

      const challengeKey = authChallengeKey(body.challenge ?? "");
      const expectedChallenge = await getJsonCache<string>(
        authChallengeKey(body.response.clientDataJSON),
      );

      // The challenge is embedded inside clientDataJSON (base64url-encoded JSON).
      // Extract it to look up the stored value.
      let storedChallenge: string | null = null;
      try {
        const clientData = JSON.parse(
          Buffer.from(body.response.clientDataJSON, "base64url").toString(
            "utf8",
          ),
        );
        storedChallenge = await getJsonCache<string>(
          authChallengeKey(clientData.challenge),
        );
      } catch {
        set.status = 400;
        return { error: "Invalid client data." };
      }

      if (!storedChallenge) {
        set.status = 400;
        return { error: "Challenge expired or not found. Please try again." };
      }

      let verification;
      try {
        verification = await verifyAuthenticationResponse({
          response: body as Parameters<
            typeof verifyAuthenticationResponse
          >[0]["response"],
          expectedChallenge: storedChallenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          credential: {
            id: credential.credentialId,
            publicKey: new Uint8Array(credential.publicKey),
            counter: Number(credential.counter),
            transports: credential.transports as AuthenticatorTransport[],
          },
        });
      } catch (err) {
        set.status = 401;
        return { error: "Passkey authentication failed." };
      }

      if (!verification.verified) {
        set.status = 401;
        return { error: "Passkey authentication failed." };
      }

      // Consume the challenge
      try {
        const clientData = JSON.parse(
          Buffer.from(body.response.clientDataJSON, "base64url").toString(
            "utf8",
          ),
        );
        await deleteCache(authChallengeKey(clientData.challenge));
      } catch {
        /* best-effort */
      }

      // Update counter
      await prisma.webAuthnCredential.update({
        where: { id: credential.id },
        data: { counter: BigInt(verification.authenticationInfo.newCounter) },
      });

      const { user } = credential;

      // Issue session identical to password login
      const ACCESS_TOKEN_TTL_SECONDS = 7 * 86400;
      const { signAccessToken, createRefreshToken, mapUser } =
        await import("../auth");
      // Re-use the same helpers — but they're not exported; inline here:
      const { jwt: jwtPlugin } = await import("@elysiajs/jwt");

      // Sign JWT directly
      const jwtSecret =
        process.env.SECRET_KEY || "dev-key-change-in-production";
      const { sign } = await import("node:crypto");
      const header = Buffer.from(
        JSON.stringify({ alg: "HS256", typ: "JWT" }),
      ).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({
          id: user.id,
          ver: user.authVersion,
          exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
        }),
      ).toString("base64url");
      const sigInput = `${header}.${payload}`;
      const sig = Buffer.from(
        await crypto.subtle.sign(
          { name: "HMAC", hash: "SHA-256" },
          await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(jwtSecret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"],
          ),
          new TextEncoder().encode(sigInput),
        ),
      ).toString("base64url");
      const accessToken = `${sigInput}.${sig}`;

      auth.set({
        value: accessToken,
        httpOnly: true,
        maxAge: ACCESS_TOKEN_TTL_SECONDS,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });

      // Generate refresh token (for mobile clients)
      const { generateOpaqueToken, hashOpaqueToken } =
        await import("../utils/tokens");
      const rawToken = generateOpaqueToken();
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: hashOpaqueToken(rawToken),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          revoked: false,
        },
      });

      const { mapUser: mapper } = await import("../utils/mappers");
      return {
        user: mapper(user),
        token: accessToken,
        refreshToken: rawToken,
      };
    },
    {
      body: t.Object({
        id: t.String(),
        rawId: t.String(),
        challenge: t.Optional(t.String()),
        response: t.Object({
          clientDataJSON: t.String(),
          authenticatorData: t.String(),
          signature: t.String(),
          userHandle: t.Optional(t.String()),
        }),
        clientExtensionResults: t.Optional(t.Any()),
        type: t.String(),
      }),
    },
  );
```

> **Note on JWT signing:** The `jwt` context from `@elysiajs/jwt` is not available outside of Elysia's derive chain. The authenticate/verify route needs to issue a JWT the same way `auth.ts` does. Rather than duplicating the HS256 signing logic with Web Crypto (which is brittle), refactor first in Task 5b below.

- [ ] **Step 2: ~~Refactor JWT signing into a shared helper~~ (SKIP — the correct approach in Step 3 uses `.use(auth)` to get the `jwt` context directly, no shared helper needed)**

Before finishing `passkey.ts`, extract the JWT signing from `auth.ts` into a standalone helper so both files can call it.

Add this to `apps/api/src/utils/jwt.ts` (new file):

```typescript
const ACCESS_TOKEN_TTL_SECONDS = 7 * 86400;

export async function signJwt(
  userId: number,
  authVersion: number,
  secret: string,
): Promise<string> {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      id: userId,
      ver: authVersion,
      exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
    }),
  ).toString("base64url");
  const sigInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const rawSig = await crypto.subtle.sign(
    { name: "HMAC" },
    key,
    new TextEncoder().encode(sigInput),
  );
  const sig = Buffer.from(rawSig).toString("base64url");
  return `${sigInput}.${sig}`;
}

export { ACCESS_TOKEN_TTL_SECONDS };
```

**However** — this custom JWT won't verify correctly against `@elysiajs/jwt` which uses its own internal structure. **Do not do this.** Instead, thread the `jwt` instance through or move the JWT signing concern into a service.

The correct approach is simpler: move the `signAccessToken` function from `auth.ts` to a separate exported helper so `passkey.ts` can call it via the `jwt` context that Elysia provides.

**Revised approach for `passkey.ts`:** The authenticate/verify route should `.use(auth)` (the Elysia auth plugin that sets up `jwt` and `cookie`) so the `jwt` context is available in the handler, just like all other routes.

- [ ] **Step 3: Rewrite `passkey.ts` using `.use(auth)` for session issuance**

Replace the content of `apps/api/src/routes/passkey.ts` with the corrected version:

```typescript
import { Elysia, t } from "elysia";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { AuthenticatorTransport } from "@simplewebauthn/types";
import { prisma } from "../db";
import { auth } from "../auth";
import { requireUser } from "../middleware/auth";
import { getWebAuthnConfig } from "../config";
import { getJsonCache, setJsonCache, deleteCache } from "../services/cache";
import { mapUser } from "../utils/mappers";
import { generateOpaqueToken, hashOpaqueToken } from "../utils/tokens";

const CHALLENGE_TTL = 60;
const ACCESS_TOKEN_TTL_SECONDS = 7 * 86400;

const regChallengeKey = (userId: number) => `webauthn:reg-challenge:${userId}`;
const authChallengeKey = (challenge: string) =>
  `webauthn:auth-challenge:${challenge}`;

async function signAccessToken(
  jwt: {
    sign: (v: { id: number; ver: number; exp: number }) => Promise<string>;
  },
  userId: number,
  authVersion: number,
): Promise<string> {
  return jwt.sign({
    id: userId,
    ver: authVersion,
    exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
  });
}

async function createRefreshToken(userId: number): Promise<string> {
  const token = generateOpaqueToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      token: hashOpaqueToken(token),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      revoked: false,
    },
  });
  return token;
}

export const passkeyRoutes = new Elysia({ prefix: "/api/auth/passkey" })
  .use(auth)
  // ── Registration (authenticated user adds a passkey) ────────────────────────
  .post("/register/options", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const { rpID, rpName } = getWebAuthnConfig();

    const existing = await prisma.webAuthnCredential.findMany({
      where: { userId: user.id },
      select: { credentialId: true, transports: true },
    });

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.email,
      userID: Buffer.from(user.id.toString(), "utf8"),
      excludeCredentials: existing.map((c) => ({
        id: c.credentialId,
        transports: c.transports as AuthenticatorTransport[],
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    await setJsonCache(
      regChallengeKey(user.id),
      options.challenge,
      CHALLENGE_TTL,
    );
    return options;
  })
  .post(
    "/register/verify",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { rpID, origin } = getWebAuthnConfig();
      const expectedChallenge = await getJsonCache<string>(
        regChallengeKey(user.id),
      );

      if (!expectedChallenge) {
        set.status = 400;
        return { error: "Challenge expired or not found. Please try again." };
      }

      let verification;
      try {
        verification = await verifyRegistrationResponse({
          response: body as Parameters<
            typeof verifyRegistrationResponse
          >[0]["response"],
          expectedChallenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
        });
      } catch {
        set.status = 400;
        return { error: "Passkey verification failed." };
      }

      if (!verification.verified || !verification.registrationInfo) {
        set.status = 400;
        return { error: "Passkey verification failed." };
      }

      await deleteCache(regChallengeKey(user.id));

      const { credential, credentialDeviceType, credentialBackedUp } =
        verification.registrationInfo;

      const existing = await prisma.webAuthnCredential.findUnique({
        where: { credentialId: credential.id },
      });
      if (existing) {
        set.status = 409;
        return { error: "This passkey is already registered." };
      }

      await prisma.webAuthnCredential.create({
        data: {
          userId: user.id,
          credentialId: credential.id,
          publicKey: Buffer.from(credential.publicKey),
          counter: BigInt(credential.counter),
          transports: (credential.transports ?? []) as string[],
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          name: body.name ?? null,
        },
      });

      return { verified: true };
    },
    {
      body: t.Object({
        id: t.String(),
        rawId: t.String(),
        response: t.Object({
          clientDataJSON: t.String(),
          attestationObject: t.String(),
          transports: t.Optional(t.Array(t.String())),
        }),
        clientExtensionResults: t.Optional(t.Any()),
        type: t.String(),
        name: t.Optional(t.String()),
      }),
    },
  )
  // ── Authentication (public — no session required) ───────────────────────────
  .post("/authenticate/options", async () => {
    const { rpID } = getWebAuthnConfig();

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
    });

    await setJsonCache(
      authChallengeKey(options.challenge),
      options.challenge,
      CHALLENGE_TTL,
    );

    return options;
  })
  .post(
    "/authenticate/verify",
    async ({ body, set, jwt, cookie: { auth: authCookie } }) => {
      const { rpID, origin } = getWebAuthnConfig();

      const credential = await prisma.webAuthnCredential.findUnique({
        where: { credentialId: body.id },
        include: { user: true },
      });

      if (!credential) {
        set.status = 401;
        return { error: "Passkey not found." };
      }

      // Extract challenge from clientDataJSON to look up the stored value
      let storedChallenge: string | null = null;
      try {
        const clientData = JSON.parse(
          Buffer.from(body.response.clientDataJSON, "base64url").toString(
            "utf8",
          ),
        );
        storedChallenge = await getJsonCache<string>(
          authChallengeKey(clientData.challenge),
        );
      } catch {
        set.status = 400;
        return { error: "Invalid client data." };
      }

      if (!storedChallenge) {
        set.status = 400;
        return { error: "Challenge expired or not found. Please try again." };
      }

      let verification;
      try {
        verification = await verifyAuthenticationResponse({
          response: body as Parameters<
            typeof verifyAuthenticationResponse
          >[0]["response"],
          expectedChallenge: storedChallenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          credential: {
            id: credential.credentialId,
            publicKey: new Uint8Array(credential.publicKey),
            counter: Number(credential.counter),
            transports: credential.transports as AuthenticatorTransport[],
          },
        });
      } catch {
        set.status = 401;
        return { error: "Passkey authentication failed." };
      }

      if (!verification.verified) {
        set.status = 401;
        return { error: "Passkey authentication failed." };
      }

      // Consume challenge (single-use)
      try {
        const clientData = JSON.parse(
          Buffer.from(body.response.clientDataJSON, "base64url").toString(
            "utf8",
          ),
        );
        await deleteCache(authChallengeKey(clientData.challenge));
      } catch {
        /* best-effort */
      }

      await prisma.webAuthnCredential.update({
        where: { id: credential.id },
        data: { counter: BigInt(verification.authenticationInfo.newCounter) },
      });

      const { user } = credential;
      const accessToken = await signAccessToken(jwt, user.id, user.authVersion);

      authCookie.set({
        value: accessToken,
        httpOnly: true,
        maxAge: ACCESS_TOKEN_TTL_SECONDS,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });

      const refreshToken = await createRefreshToken(user.id);

      return {
        user: mapUser(user),
        token: accessToken,
        refreshToken,
      };
    },
    {
      body: t.Object({
        id: t.String(),
        rawId: t.String(),
        response: t.Object({
          clientDataJSON: t.String(),
          authenticatorData: t.String(),
          signature: t.String(),
          userHandle: t.Optional(t.String()),
        }),
        clientExtensionResults: t.Optional(t.Any()),
        type: t.String(),
      }),
    },
  );
```

- [ ] **Step 4: Add listing and deletion routes**

Append two more routes to `passkeyRoutes` in `passkey.ts` (before the closing of the Elysia chain):

```typescript
  // ── Credential management ───────────────────────────────────────────────────
  .get(
    "/credentials",
    async ({ user, set }) => {
      if (!user) { set.status = 401; return { error: "Unauthorized" }; }
      const creds = await prisma.webAuthnCredential.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          credentialId: true,
          name: true,
          deviceType: true,
          backedUp: true,
          transports: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
      return {
        credentials: creds.map((c) => ({
          id: c.id,
          credential_id: c.credentialId,
          name: c.name,
          device_type: c.deviceType,
          backed_up: c.backedUp,
          transports: c.transports,
          created_at: c.createdAt.toISOString(),
        })),
      };
    },
  )
  .delete(
    "/credentials/:id",
    async ({ user, params, set }) => {
      if (!user) { set.status = 401; return { error: "Unauthorized" }; }

      const cred = await prisma.webAuthnCredential.findFirst({
        where: { id: Number(params.id), userId: user.id },
      });

      if (!cred) {
        set.status = 404;
        return { error: "Credential not found." };
      }

      await prisma.webAuthnCredential.delete({ where: { id: cred.id } });
      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );
```

- [ ] **Step 5: Run tests**

```bash
cd apps/api && bun test test/passkey.test.ts
```

Expected: `GET /api/auth/passkey/authenticate/options returns 200 with challenge` now PASSES.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/passkey.ts
git commit -m "feat(passkey): WebAuthn registration and authentication routes"
```

---

## Task 6: Wire passkey routes into the API

**Files:**

- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Import and compose `passkeyRoutes`**

In `apps/api/src/index.ts`, add the import after the other route imports:

```typescript
import { passkeyRoutes } from "./routes/passkey";
```

Then add `.use(passkeyRoutes)` in the chain, after `.use(auth)` but alongside the other route uses:

```typescript
  .use(passkeyRoutes)
```

- [ ] **Step 2: Run all API tests**

```bash
cd apps/api && bun test
```

Expected: 135 passing, no regressions.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat(api): register passkeyRoutes"
```

---

## Task 7: Add `has_passkey` to user mapper and shared type

**Files:**

- Modify: `apps/api/src/utils/mappers.ts`
- Modify: `apps/shared/src/types/user.ts`

The frontend needs to know whether the current user has passkeys registered so it can show the right UI.

- [ ] **Step 1: Update `mapUser` to accept and expose `has_passkey`**

In `apps/api/src/utils/mappers.ts`, update the `mapUser` function signature and return:

```typescript
export const mapUser = (
  user: {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
    isAdmin: boolean | null;
    locale: string | null;
    lastLogin: Date | null;
    createdAt: Date | null;
    lastActivity: Date | null;
    avatarUrl: string | null;
  },
  options?: { hasPasskey?: boolean },
) => ({
  id: user.id,
  email: user.email,
  first_name: user.firstName,
  last_name: user.lastName,
  is_admin: user.isAdmin || false,
  locale: user.locale ?? null,
  last_login: user.lastLogin?.toISOString() ?? null,
  created_at: user.createdAt?.toISOString() ?? new Date().toISOString(),
  last_activity: user.lastActivity?.toISOString() ?? null,
  avatar_url: user.avatarUrl || null,
  has_passkey: options?.hasPasskey ?? false,
});
```

- [ ] **Step 2: Update `GET /api/auth/me` to populate `has_passkey`**

In `apps/api/src/auth.ts`, update the `/me` handler to count passkey credentials:

```typescript
.get("/me", async ({ user, set }) => {
  if (!user) {
    set.status = 401;
    return { user: null };
  }

  const [dbUser, passkeyCount] = await Promise.all([
    prisma.user.findFirst({ where: { id: user.id } }),
    prisma.webAuthnCredential.count({ where: { userId: user.id } }),
  ]);

  if (!dbUser) {
    set.status = 401;
    return { user: null };
  }

  return { user: mapUser(dbUser, { hasPasskey: passkeyCount > 0 }) };
})
```

- [ ] **Step 3: Update shared `User` type**

In `apps/shared/src/types/user.ts`, add the optional field:

```typescript
export interface User {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_admin: boolean;
  locale?: string | null;
  last_login: string | null;
  created_at: string;
  last_activity: string | null;
  avatar_url?: string | null;
  has_passkey?: boolean;
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/utils/mappers.ts apps/api/src/auth.ts apps/shared/src/types/user.ts
git commit -m "feat(auth): expose has_passkey flag on user response"
```

---

## Task 8: Web — endpoint constants and passkey hooks

**Files:**

- Modify: `apps/web/src/lib/endpoints/auth.ts`
- Create: `apps/web/src/lib/auth/usePasskey.ts`

- [ ] **Step 1: Add endpoint constants**

In `apps/web/src/lib/endpoints/auth.ts`, extend the `AUTH_ENDPOINTS` object:

```typescript
export const AUTH_ENDPOINTS = {
  ME: "/api/auth/me",
  LOGIN: "/api/auth/login",
  LOGOUT: "/api/auth/logout",
  FORGOT_PASSWORD: "/api/auth/forgot-password",
  RESET_PASSWORD: "/api/auth/reset-password",
  ACCEPT_INVITATION: "/api/auth/accept-invitation",
  PASSKEY_REGISTER_OPTIONS: "/api/auth/passkey/register/options",
  PASSKEY_REGISTER_VERIFY: "/api/auth/passkey/register/verify",
  PASSKEY_AUTHENTICATE_OPTIONS: "/api/auth/passkey/authenticate/options",
  PASSKEY_AUTHENTICATE_VERIFY: "/api/auth/passkey/authenticate/verify",
  PASSKEY_CREDENTIALS: "/api/auth/passkey/credentials",
} as const;
```

- [ ] **Step 2: Create `usePasskey.ts`**

Create `apps/web/src/lib/auth/usePasskey.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { AUTH_ENDPOINTS } from "@/lib/endpoints";
import { setUser } from "@/lib/auth";
import type { User } from "@hously/shared/types";

export { browserSupportsWebAuthn };

interface PasskeyCredential {
  id: number;
  credential_id: string;
  name: string | null;
  device_type: string;
  backed_up: boolean;
  transports: string[];
  created_at: string;
}

interface CredentialsResponse {
  credentials: PasskeyCredential[];
}

export function usePasskeyCredentials() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.auth.passkeyCredentials,
    queryFn: () =>
      fetcher<CredentialsResponse>(AUTH_ENDPOINTS.PASSKEY_CREDENTIALS),
  });
}

export function usePasskeyRegister() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name?: string) => {
      const options = await fetcher<PublicKeyCredentialCreationOptionsJSON>(
        AUTH_ENDPOINTS.PASSKEY_REGISTER_OPTIONS,
        { method: "POST" },
      );
      const attResp = await startRegistration({ optionsJSON: options });
      return fetcher<{ verified: boolean }>(
        AUTH_ENDPOINTS.PASSKEY_REGISTER_VERIFY,
        {
          method: "POST",
          body: { ...attResp, name: name ?? null },
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.auth.passkeyCredentials,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
  });
}

export function useDeletePasskey() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentialId: number) =>
      fetcher<{ success: boolean }>(
        `${AUTH_ENDPOINTS.PASSKEY_CREDENTIALS}/${credentialId}`,
        {
          method: "DELETE",
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.auth.passkeyCredentials,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
  });
}

interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export function usePasskeyAuthenticate() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const options = await fetcher<PublicKeyCredentialRequestOptionsJSON>(
        AUTH_ENDPOINTS.PASSKEY_AUTHENTICATE_OPTIONS,
        { method: "POST" },
      );
      const assertResp = await startAuthentication({ optionsJSON: options });
      return fetcher<AuthResponse>(AUTH_ENDPOINTS.PASSKEY_AUTHENTICATE_VERIFY, {
        method: "POST",
        body: assertResp,
      });
    },
    onSuccess: (data) => {
      if (data.user) setUser(data.user);
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
  });
}
```

- [ ] **Step 3: Add `passkeyCredentials` to query keys**

In `apps/web/src/lib/queryKeys.ts` (or wherever `queryKeys.auth` is defined), add:

```typescript
auth: {
  all: ["auth"] as const,
  me: ["auth", "me"] as const,
  validateInvitation: (token: string) => ["auth", "invitation", token] as const,
  passkeyCredentials: ["auth", "passkey-credentials"] as const,
},
```

(Add `passkeyCredentials` to the existing `auth` key group — do not duplicate the other keys.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/endpoints/auth.ts apps/web/src/lib/auth/usePasskey.ts apps/web/src/lib/queryKeys.ts
git commit -m "feat(web): passkey endpoint constants and hooks"
```

---

## Task 9: Settings — PasskeysSection component

**Files:**

- Create: `apps/web/src/pages/settings/_component/PasskeysSection.tsx`
- Modify: `apps/web/src/pages/settings/_component/ProfileTab.tsx`

- [ ] **Step 1: Create `PasskeysSection.tsx`**

```tsx
import { useState } from "react";
import { KeyRound, Trash2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  usePasskeyCredentials,
  usePasskeyRegister,
  useDeletePasskey,
  browserSupportsWebAuthn,
} from "@/lib/auth/usePasskey";
import { formatDateTime } from "@hously/shared/utils";

export function PasskeysSection() {
  const { t, i18n } = useTranslation("common");
  const [registerName, setRegisterName] = useState("");

  const { data, isLoading } = usePasskeyCredentials();
  const register = usePasskeyRegister();
  const deletePasskey = useDeletePasskey();

  if (!browserSupportsWebAuthn()) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 mt-6">
        <h2 className="text-lg font-semibold mb-1.5 text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <KeyRound className="w-5 h-5" />
          {t("settings.passkeys.title")}
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {t("settings.passkeys.notSupported")}
        </p>
      </div>
    );
  }

  const handleRegister = async () => {
    try {
      await register.mutateAsync(registerName || undefined);
      toast.success(t("settings.passkeys.registerSuccess"));
      setRegisterName("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t("settings.passkeys.registerError"));
    }
  };

  const handleDelete = async (id: number, name: string | null) => {
    if (
      !confirm(
        t("settings.passkeys.deleteConfirm", { name: name || "this passkey" }),
      )
    )
      return;
    try {
      await deletePasskey.mutateAsync(id);
      toast.success(t("settings.passkeys.deleteSuccess"));
    } catch {
      toast.error(t("settings.passkeys.deleteError"));
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 mt-6">
      <h2 className="text-lg font-semibold mb-1.5 text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
        <KeyRound className="w-5 h-5" />
        {t("settings.passkeys.title")}
      </h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-6 text-sm">
        {t("settings.passkeys.description")}
      </p>

      {/* Register new passkey */}
      <div className="flex items-center gap-3 mb-6">
        <input
          type="text"
          value={registerName}
          onChange={(e) => setRegisterName(e.target.value)}
          placeholder={t("settings.passkeys.namePlaceholder")}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          onClick={handleRegister}
          disabled={register.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {register.isPending
            ? t("settings.passkeys.registering")
            : t("settings.passkeys.addPasskey")}
        </button>
      </div>

      {/* Registered passkeys list */}
      {isLoading ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {t("common.loading")}
        </p>
      ) : !data?.credentials?.length ? (
        <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
          <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">{t("settings.passkeys.noPasskeys")}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {data.credentials.map((cred) => (
            <li
              key={cred.id}
              className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-700/50 border border-neutral-200 dark:border-neutral-600"
            >
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {cred.name || t("settings.passkeys.unnamedPasskey")}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {cred.device_type === "multiDevice"
                    ? t("settings.passkeys.multiDevice")
                    : t("settings.passkeys.singleDevice")}
                  {cred.backed_up && ` · ${t("settings.passkeys.backedUp")}`}
                  {" · "}
                  {t("settings.passkeys.addedOn", {
                    date: formatDateTime(cred.created_at, i18n.language),
                  })}
                </p>
              </div>
              <button
                onClick={() => handleDelete(cred.id, cred.name)}
                disabled={deletePasskey.isPending}
                className="p-1.5 text-red-500 hover:text-red-700 dark:hover:text-red-400 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Render `PasskeysSection` in `ProfileTab`**

In `apps/web/src/pages/settings/_component/ProfileTab.tsx`, import and append the section:

```tsx
import { useTranslation } from "react-i18next";
import { ProfileForm } from "@/pages/settings/_component/ProfileForm";
import { PasskeysSection } from "@/pages/settings/_component/PasskeysSection";

export function ProfileTab() {
  const { t } = useTranslation("common");

  return (
    <div
      className="animate-in fade-in slide-in-from-left-4 duration-300"
      key="profile-tab"
    >
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
        <h2 className="text-lg font-semibold mb-1.5 text-neutral-900 dark:text-neutral-100">
          {t("settings.profile.title")}
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          {t("settings.profile.description")}
        </p>
        <ProfileForm />
      </div>

      <PasskeysSection />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/settings/_component/PasskeysSection.tsx \
        apps/web/src/pages/settings/_component/ProfileTab.tsx
git commit -m "feat(settings): passkey management UI in Profile tab"
```

---

## Task 10: Login page — passkey sign-in button

**Files:**

- Modify: `apps/web/src/pages/login/_component/LoginForm.tsx`

- [ ] **Step 1: Add passkey button to `LoginForm`**

```tsx
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { setUser } from "@/lib/auth";
import { useLogin } from "@/lib/auth/useAuth";
import {
  usePasskeyAuthenticate,
  browserSupportsWebAuthn,
} from "@/lib/auth/usePasskey";

interface FormData {
  email: string;
  password: string;
}

export function LoginForm() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const passkeyMutation = usePasskeyAuthenticate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: FormData) => {
    try {
      const response = await loginMutation.mutateAsync({
        email: data.email,
        password: data.password,
      });
      if (response.user) setUser(response.user);
      navigate({ to: "/" });
    } catch (err: unknown) {
      toast.error(
        (err instanceof Error ? err.message : null) ||
          loginMutation.error?.message ||
          t("login.authFailed"),
      );
    }
  };

  const onPasskeyLogin = async () => {
    try {
      const response = await passkeyMutation.mutateAsync();
      if (response.user) setUser(response.user);
      navigate({ to: "/" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      if (msg && !msg.includes("cancelled")) {
        toast.error(msg || t("login.passkeyFailed"));
      }
    }
  };

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
      <div className="rounded-md shadow-sm -space-y-px">
        <div>
          <label htmlFor="email" className="sr-only">
            {t("login.emailAddress")}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email webauthn"
            {...register("email", {
              required: true,
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: t("login.invalidEmail") || "Invalid email address",
              },
            })}
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 placeholder-neutral-500 dark:placeholder-neutral-400 text-neutral-900 dark:text-white bg-white dark:bg-neutral-800 rounded-t-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
            placeholder={t("login.emailAddress")}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.email.message || t("login.emailRequired")}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="sr-only">
            {t("login.password")}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register("password", { required: true })}
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 placeholder-neutral-500 dark:placeholder-neutral-400 text-neutral-900 dark:text-white bg-white dark:bg-neutral-800 rounded-b-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
            placeholder={t("login.password")}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.password.message || t("login.passwordRequired")}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Link
          to="/forgot-password"
          className="text-sm text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
        >
          {t("login.forgotPassword")}
        </Link>
      </div>

      <div className="space-y-3">
        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loginMutation.isPending
            ? t("login.loading")
            : t("login.signInButton")}
        </button>

        {browserSupportsWebAuthn() && (
          <>
            <div className="relative flex items-center">
              <div className="flex-1 border-t border-neutral-300 dark:border-neutral-600" />
              <span className="px-3 text-xs text-neutral-500 dark:text-neutral-400">
                {t("login.or")}
              </span>
              <div className="flex-1 border-t border-neutral-300 dark:border-neutral-600" />
            </div>
            <button
              type="button"
              onClick={onPasskeyLogin}
              disabled={passkeyMutation.isPending}
              className="group relative w-full flex justify-center items-center gap-2 py-2 px-4 border border-neutral-300 dark:border-neutral-600 text-sm font-medium rounded-md text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <KeyRound className="w-4 h-4" />
              {passkeyMutation.isPending
                ? t("login.loading")
                : t("login.signInWithPasskey")}
            </button>
          </>
        )}
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/login/_component/LoginForm.tsx
git commit -m "feat(login): add passkey sign-in button"
```

---

## Task 11: i18n — add translation keys

**Files:**

- Modify translation files under `apps/web/src/locales/` (check existing structure for exact file names/paths)

- [ ] **Step 1: Identify translation file locations**

```bash
find apps/web/src/locales -name "*.json" | head -10
```

- [ ] **Step 2: Add English keys**

In the `en` common translation file, add under the top-level object:

```json
"login": {
  "signInWithPasskey": "Sign in with a passkey",
  "passkeyFailed": "Passkey authentication failed",
  "or": "or"
},
"settings": {
  "passkeys": {
    "title": "Passkeys",
    "description": "Passkeys let you sign in securely without a password using your device's biometrics or PIN.",
    "notSupported": "Your browser does not support passkeys.",
    "addPasskey": "Add a passkey",
    "registering": "Registering…",
    "namePlaceholder": "Passkey name (optional)",
    "registerSuccess": "Passkey registered successfully.",
    "registerError": "Failed to register passkey.",
    "deleteConfirm": "Remove {{name}}?",
    "deleteSuccess": "Passkey removed.",
    "deleteError": "Failed to remove passkey.",
    "noPasskeys": "No passkeys registered yet.",
    "unnamedPasskey": "Unnamed passkey",
    "multiDevice": "Synced",
    "singleDevice": "Device-bound",
    "backedUp": "backed up",
    "addedOn": "Added {{date}}"
  }
}
```

> Merge these keys into the existing `login` and `settings` sections rather than creating duplicate top-level keys.

- [ ] **Step 3: Repeat for all other supported locales** (copy English values; native speakers can translate later)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/locales/
git commit -m "feat(i18n): add passkey translation keys"
```

---

## Task 12: TypeScript check + full test run

- [ ] **Step 1: Type-check the frontend**

```bash
make typecheck
```

Expected: 0 errors. Fix any type errors before continuing.

- [ ] **Step 2: Run all tests**

```bash
make test
```

Expected: all existing tests pass (135 API + 62 web minimum). New passkey tests pass.

- [ ] **Step 3: Start dev server and manually verify**

```bash
# Terminal 1
make dev-api

# Terminal 2
make dev-web
```

Visit `http://localhost:5173/login` — confirm "Sign in with a passkey" button renders (if browser supports WebAuthn).

Visit `http://localhost:5173/settings?tab=profile` — confirm "Passkeys" section renders at bottom of Profile tab.

Register a passkey using the settings UI. Sign out. Sign in using the passkey button.

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git add -p
git commit -m "chore(passkey): post-review cleanup"
```

---

## Environment variable checklist for deployment

Before deploying, set these in production `.env`:

```
WEBAUTHN_RP_ID=yourdomain.com          # just the hostname, no protocol/port
WEBAUTHN_RP_NAME=Hously
WEBAUTHN_ORIGIN=https://yourdomain.com # full origin, must match browser
```

For local dev with `localhost`, the defaults derived from `BASE_URL=http://localhost:3000` work without setting these vars explicitly.
