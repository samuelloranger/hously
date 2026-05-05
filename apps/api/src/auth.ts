import { Elysia, t } from "elysia";
import { prisma } from "@hously/api/db";
import { auth as betterAuth } from "@hously/api/lib/auth";
import { requireUser, resolveUser } from "@hously/api/middleware/auth";
import {
  updateUserAvatarFromUpload,
  updateUserProfile,
} from "@hously/api/services/userProfileService";
import { hashPassword, verifyPassword } from "@hously/api/utils/password";
import { mapUser } from "@hously/api/utils/mappers";
import { opaqueTokenCandidates } from "@hously/api/utils/tokens";
import { validatePassword } from "@hously/api/utils/validation";

export const auth = (app: Elysia) =>
  app.resolve(async ({ request }) => ({ user: await resolveUser(request) }));

export const publicAuthRoutes = new Elysia({ name: "auth/public" })
  .get(
    "/api/auth/accept-invitation",
    async ({ query, set }) => {
      const { token } = query;
      if (!token) {
        set.status = 400;
        return { valid: false, error: "Token is required" };
      }

      const invitation = await prisma.invitation.findFirst({
        where: {
          token: { in: opaqueTokenCandidates(token) },
          status: "pending",
          expiresAt: { gt: new Date() },
        },
      });

      if (!invitation) {
        return { valid: false, error: "Invalid or expired invitation" };
      }

      return { valid: true, email: invitation.email };
    },
    { query: t.Object({ token: t.String() }) },
  )
  .post(
    "/api/auth/accept-invitation",
    async ({ body, request, set }) => {
      const { token, password, first_name, last_name } = body;
      const [passwordValid, passwordError] = validatePassword(password);
      if (!passwordValid) {
        set.status = 400;
        return { error: passwordError };
      }

      const invitation = await prisma.invitation.findFirst({
        where: {
          token: { in: opaqueTokenCandidates(token) },
          status: "pending",
          expiresAt: { gt: new Date() },
        },
      });
      if (!invitation) {
        set.status = 400;
        return { error: "Invalid or expired invitation" };
      }

      const existingUser = await prisma.user.findUnique({
        where: { email: invitation.email },
      });
      if (existingUser) {
        set.status = 400;
        return { error: "An account with this email already exists" };
      }

      const passwordHash = await hashPassword(password);
      const displayName = [first_name, last_name].filter(Boolean).join(" ");
      const newUser = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: displayName || invitation.email,
            email: invitation.email,
            emailVerified: false,
            passwordHash,
            firstName: first_name || null,
            lastName: last_name || null,
            isAdmin: invitation.isAdmin,
            locale: invitation.locale || "en",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        await tx.baAccount.create({
          data: {
            id: crypto.randomUUID(),
            accountId: invitation.email,
            providerId: "credential",
            userId: user.id,
            password: passwordHash,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: "accepted", acceptedAt: new Date() },
        });

        return user;
      });

      const signIn = await betterAuth.api.signInEmail({
        body: { email: invitation.email, password },
        headers: request.headers,
        returnHeaders: true,
      });
      const setCookie = signIn.headers.get("set-cookie");
      if (setCookie) {
        set.headers["set-cookie"] = setCookie;
      }

      set.status = 201;
      return { user: mapUser(newUser) };
    },
    {
      body: t.Object({
        token: t.String(),
        password: t.String(),
        first_name: t.Optional(t.String()),
        last_name: t.Optional(t.String()),
      }),
    },
  );

export const ssoProvidersRoute = new Elysia({ name: "auth/sso-providers" }).get(
  "/api/auth/sso-providers",
  async () => {
    const authentik = await prisma.integration.findFirst({
      where: { type: "authentik", enabled: true },
      select: { id: true },
    });
    return { authentik: Boolean(authentik) };
  },
);

export const protectedAuthRoutes = new Elysia({ name: "auth/protected" })
  .use(requireUser)
  .get("/api/auth/me", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { user: null };
    }

    const [dbUser, passkeyCount] = await Promise.all([
      prisma.user.findUnique({ where: { id: user.id } }),
      prisma.baPasskey.count({ where: { userId: user.id } }),
    ]);
    if (!dbUser) {
      set.status = 401;
      return { user: null };
    }

    return { user: mapUser(dbUser, { hasPasskey: passkeyCount > 0 }) };
  })
  .put(
    "/api/auth/me",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const result = await updateUserProfile(user.id, body);
      if (!result.ok) {
        set.status = result.status;
        return { error: result.error };
      }

      return { user: mapUser(result.user) };
    },
    {
      body: t.Object({
        first_name: t.Optional(t.Union([t.String(), t.Null()])),
        last_name: t.Optional(t.Union([t.String(), t.Null()])),
        locale: t.Optional(t.Union([t.String(), t.Null()])),
        country_code: t.Optional(t.Union([t.String(), t.Null()])),
        calendar_subdivision_code: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    },
  )
  .post(
    "/api/auth/change-password",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { current_password, new_password } = body;
      const [passwordValid, passwordError] = validatePassword(new_password);
      if (!passwordValid) {
        set.status = 400;
        return { error: passwordError };
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { passwordHash: true },
      });
      if (!dbUser?.passwordHash) {
        set.status = 400;
        return { error: "This account does not have a password." };
      }

      const currentValid = await verifyPassword(
        current_password,
        dbUser.passwordHash,
      );
      if (!currentValid) {
        set.status = 400;
        return { error: "Current password is incorrect" };
      }

      const passwordHash = await hashPassword(new_password);
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { passwordHash },
        }),
        prisma.baAccount.updateMany({
          where: { userId: user.id, providerId: "credential" },
          data: { password: passwordHash },
        }),
      ]);

      return { message: "Password updated successfully" };
    },
    {
      body: t.Object({
        current_password: t.String(),
        new_password: t.String(),
      }),
    },
  )
  .post(
    "/api/auth/avatar",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { avatar } = body;
      const isWebFile = avatar instanceof File;
      const isReactNativeFile =
        avatar &&
        typeof avatar === "object" &&
        "uri" in avatar &&
        "name" in avatar &&
        "type" in avatar;
      if (!avatar || (!isWebFile && !isReactNativeFile)) {
        set.status = 400;
        return { error: "Avatar file is required" };
      }

      const result = await updateUserAvatarFromUpload(user.id, avatar);
      if (!result.ok) {
        set.status = 400;
        return { error: result.message };
      }

      return {
        message: "Avatar uploaded successfully",
        avatar_url: result.avatarUrl,
        url: result.avatarUrl,
      };
    },
    {
      body: t.Object({ avatar: t.Any() }),
      type: "multipart/form-data",
    },
  );
