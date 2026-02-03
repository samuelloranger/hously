import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { cookie } from "@elysiajs/cookie";
import { db } from "./db";
import { users, passwordResetTokens } from "./db/schema";
import { eq, and, gt } from "drizzle-orm";
import { hashPassword, verifyPassword } from "./utils/password";
import { authRateLimit } from "./middleware/rateLimit";
import { validateEmail, validatePassword } from "./utils/validation";
import { loadAccessControl, getBaseUrl } from "./utils/config";

// Map database user (camelCase) to frontend user (snake_case)
const mapUser = (user: typeof users.$inferSelect) => ({
  id: user.id,
  email: user.email,
  first_name: user.firstName,
  last_name: user.lastName,
  is_admin: user.isAdmin || false,
  last_login: user.lastLogin,
  created_at: user.createdAt || new Date().toISOString(),
  last_activity: user.lastActivity,
});

export const auth = (app: Elysia) =>
  app
    .use(
      jwt({
        name: "jwt",
        secret: process.env.SECRET_KEY || "dev-key-change-in-production",
      }),
    )
    .use(cookie())
    .derive(async ({ jwt, cookie: { auth }, set }) => {
      if (!auth.value) {
        return { user: null };
      }
      const profile = await jwt.verify(auth.value as string);
      if (!profile || !profile.id) {
        return { user: null };
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, Number(profile.id)),
      });

      if (!user) {
        return { user: null };
      }

      return { user: mapUser(user) };
    })
    .group("/api/auth", (app) =>
      app
        .use(authRateLimit)
        .post(
          "/login",
          async ({ body, jwt, set, cookie: { auth } }) => {
            const { email, password } = body;
            const user = await db.query.users.findFirst({
              where: eq(users.email, email),
            });

            if (!user) {
              set.status = 401;
              return { success: false, error: "Invalid credentials" };
            }

            try {
              const isValid = await verifyPassword(password, user.passwordHash);
              if (!isValid) {
                set.status = 401;
                return { success: false, error: "Invalid credentials" };
              }
            } catch (e) {
              console.error("Password verification error:", e);
              set.status = 500;
              return { success: false, error: "Internal server error" };
            }

            // Generate JWT with secure cookie settings
            // - httpOnly: Prevents XSS attacks from stealing the token
            // - sameSite: 'lax' provides CSRF protection (cookies not sent on cross-site POST)
            // - secure: HTTPS only in production
            auth.set({
              value: await jwt.sign({ id: user.id }),
              httpOnly: true,
              maxAge: 7 * 86400, // 7 days
              path: "/",
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
            });

            // Update last login
            await db
              .update(users)
              .set({ lastLogin: new Date().toISOString() })
              .where(eq(users.id, user.id));

            return {
              user: mapUser(user),
            };
          },
          {
            body: t.Object({
              email: t.String(),
              password: t.String(),
              locale: t.Optional(t.String()),
            }),
          },
        )
        .post(
          "/signup",
          async ({ body, jwt, set, cookie: { auth } }) => {
            const { email, password, first_name, last_name, locale } = body;

            // Validate email
            if (!validateEmail(email)) {
              set.status = 400;
              return { error: "Invalid email format" };
            }

            // Validate password
            const [isValid, passwordError] = validatePassword(password);
            if (!isValid) {
              set.status = 400;
              return { error: passwordError };
            }

            // Check if user already exists
            const existingUser = await db.query.users.findFirst({
              where: eq(users.email, email),
            });

            if (existingUser) {
              set.status = 400;
              return { error: "User with this email already exists" };
            }

            // Load access control and check if user should be admin
            const accessControl = loadAccessControl();
            const isAdmin = accessControl.adminEmails.includes(email);

            // Hash password and create user
            const passwordHash = await hashPassword(password);
            const [newUser] = await db
              .insert(users)
              .values({
                email,
                passwordHash,
                firstName: first_name || null,
                lastName: last_name || null,
                isAdmin,
                locale: locale || "en",
                createdAt: new Date().toISOString(),
              })
              .returning();

            // Generate JWT with secure cookie settings
            // - httpOnly: Prevents XSS attacks from stealing the token
            // - sameSite: 'lax' provides CSRF protection (cookies not sent on cross-site POST)
            // - secure: HTTPS only in production
            auth.set({
              value: await jwt.sign({ id: newUser.id }),
              httpOnly: true,
              maxAge: 7 * 86400, // 7 days
              path: "/",
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
            });

            console.log(`New user registered: ${email}`);

            set.status = 201;
            return {
              user: mapUser(newUser),
            };
          },
          {
            body: t.Object({
              email: t.String(),
              password: t.String(),
              first_name: t.Optional(t.String()),
              last_name: t.Optional(t.String()),
              locale: t.Optional(t.String()),
            }),
          },
        )
        .post(
          "/forgot-password",
          async ({ body, set }) => {
            const { email } = body;

            // Validate email
            if (!validateEmail(email)) {
              set.status = 400;
              return { error: "Invalid email format" };
            }

            // Always return success to prevent email enumeration
            // But only create token if user exists
            try {
              const user = await db.query.users.findFirst({
                where: eq(users.email, email),
              });

              if (user) {
                // Generate secure token (32 bytes = 43 characters in base64url)
                const tokenBytes = new Uint8Array(32);
                crypto.getRandomValues(tokenBytes);
                const token = btoa(String.fromCharCode(...tokenBytes))
                  .replace(/\+/g, "-")
                  .replace(/\//g, "_")
                  .replace(/=/g, "");

                // Token expires in 1 hour
                const expiresAt = new Date(
                  Date.now() + 60 * 60 * 1000,
                ).toISOString();

                // Delete any existing unused tokens for this user
                await db
                  .delete(passwordResetTokens)
                  .where(
                    and(
                      eq(passwordResetTokens.userId, user.id),
                      eq(passwordResetTokens.used, false),
                    ),
                  );

                // Create new token
                await db.insert(passwordResetTokens).values({
                  userId: user.id,
                  token,
                  expiresAt,
                  used: false,
                });

                // Build reset URL
                const baseUrl = getBaseUrl();
                const resetUrl = `${baseUrl}/reset-password?token=${token}`;

                console.log(
                  `Password reset requested for: ${email}. Reset URL: ${resetUrl}`,
                );
                // TODO: Send email with reset URL when email service is implemented
              }
            } catch (error) {
              console.error("Error processing forgot password request:", error);
              // Don't reveal errors to prevent enumeration
            }

            // Always return success message
            return {
              message:
                "If an account exists with this email, you will receive a reset link.",
            };
          },
          {
            body: t.Object({
              email: t.String(),
              locale: t.Optional(t.String()),
            }),
          },
        )
        .post(
          "/reset-password",
          async ({ body, set }) => {
            const { token, password } = body;

            if (!token) {
              set.status = 400;
              return { error: "Invalid reset link" };
            }

            // Validate password
            const [isValid, passwordError] = validatePassword(password);
            if (!isValid) {
              set.status = 400;
              return { error: passwordError };
            }

            try {
              // Get and validate token
              const resetToken = await db.query.passwordResetTokens.findFirst({
                where: and(
                  eq(passwordResetTokens.token, token),
                  eq(passwordResetTokens.used, false),
                  gt(passwordResetTokens.expiresAt, new Date().toISOString()),
                ),
              });

              if (!resetToken) {
                set.status = 400;
                return {
                  error: "This reset link is invalid or has expired.",
                };
              }

              // Update password
              const passwordHash = await hashPassword(password);
              await db
                .update(users)
                .set({ passwordHash })
                .where(eq(users.id, resetToken.userId));

              // Mark token as used
              await db
                .update(passwordResetTokens)
                .set({ used: true })
                .where(eq(passwordResetTokens.id, resetToken.id));

              console.log(
                `Password reset successful for user_id: ${resetToken.userId}`,
              );

              return {
                message: "Your password has been reset successfully.",
              };
            } catch (error) {
              console.error("Error resetting password:", error);
              set.status = 500;
              return { error: "Password reset failed" };
            }
          },
          {
            body: t.Object({
              token: t.String(),
              password: t.String(),
              locale: t.Optional(t.String()),
            }),
          },
        )
        .get("/me", ({ user, set }) => {
          if (!user) {
            set.status = 401;
            return { user: null };
          }
          return { user };
        })
        .post("/logout", ({ cookie: { auth } }) => {
          auth.remove();
          return { message: "Logged out" };
        }),
    );
