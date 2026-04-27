import { Elysia, t } from "elysia";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { auth } from "../auth";
import { getWebAuthnConfig } from "../config";
import { prisma } from "../db";
import { deleteCache, getJsonCache, setJsonCache } from "../services/cache";
import { mapUser } from "../utils/mappers";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  createRefreshToken,
  signAccessToken,
} from "../utils/session";

const CHALLENGE_TTL = 60;

const regChallengeKey = (userId: number) => `webauthn:reg-challenge:${userId}`;
const authChallengeKey = (challenge: string) =>
  `webauthn:auth-challenge:${challenge}`;

export const passkeyRoutes = new Elysia({ prefix: "/api/auth/passkey" })
  .use(auth)
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
        transports: c.transports as any,
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

      const existingCredential = await prisma.webAuthnCredential.findUnique({
        where: { credentialId: credential.id },
      });

      if (existingCredential) {
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
        response: t.Any(),
        clientExtensionResults: t.Optional(t.Any()),
        type: t.String(),
        name: t.Optional(t.Nullable(t.String())),
      }),
    },
  )
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
            transports: credential.transports as any,
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

      try {
        const clientData = JSON.parse(
          Buffer.from(body.response.clientDataJSON, "base64url").toString(
            "utf8",
          ),
        );
        await deleteCache(authChallengeKey(clientData.challenge));
      } catch {
        // best-effort cleanup
      }

      await prisma.webAuthnCredential.update({
        where: { id: credential.id },
        data: { counter: BigInt(verification.authenticationInfo.newCounter) },
      });

      const accessToken = await signAccessToken(
        jwt,
        credential.user.id,
        credential.user.authVersion,
      );

      authCookie.set({
        value: accessToken,
        httpOnly: true,
        maxAge: ACCESS_TOKEN_TTL_SECONDS,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });

      await prisma.user.update({
        where: { id: credential.user.id },
        data: { lastLogin: new Date() },
      });

      const refreshToken = await createRefreshToken(credential.user.id);
      const passkeyCount = await prisma.webAuthnCredential.count({
        where: { userId: credential.user.id },
      });

      return {
        user: mapUser(credential.user, { hasPasskey: passkeyCount > 0 }),
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
          userHandle: t.Optional(t.Nullable(t.String())),
        }),
        clientExtensionResults: t.Optional(t.Any()),
        type: t.String(),
      }),
    },
  )
  .get("/credentials", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

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
  })
  .delete(
    "/credentials/:id",
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const id = Number(params.id);
      if (Number.isNaN(id)) {
        set.status = 400;
        return { error: "Invalid credential id." };
      }

      const credential = await prisma.webAuthnCredential.findFirst({
        where: { id, userId: user.id },
      });

      if (!credential) {
        set.status = 404;
        return { error: "Credential not found." };
      }

      await prisma.webAuthnCredential.delete({ where: { id: credential.id } });
      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );
