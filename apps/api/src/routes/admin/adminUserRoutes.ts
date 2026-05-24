import { Elysia, t } from "elysia";
import { prisma } from "@hously/api/db";
import { formatIso, sanitizeInput } from "@hously/api/utils";
import { sendInvitationEmail } from "@hously/api/services/emailService";
import { generateOpaqueToken, hashOpaqueToken } from "@hously/api/utils/tokens";
import { badRequest, notFound, serverError } from "@hously/api/errors";
import { requireAdmin } from "@hously/api/middleware/auth";

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const adminUserRoutes = new Elysia()
  .use(requireAdmin)
  // GET /api/admin/users - List all users
  .get("/users", async ({ set }) => {
    try {
      const allUsers = await prisma.user.findMany({
        orderBy: { createdAt: "desc" },
      });

      const usersData = allUsers.map((u) => ({
        id: u.id,
        email: u.email,
        first_name: u.firstName,
        last_name: u.lastName,
        is_admin: u.isAdmin,
        locale: u.locale || "en",
        created_at: formatIso(u.createdAt),
        last_login: formatIso(u.lastLogin),
      }));

      return {
        success: true,
        users: usersData,
      };
    } catch (error) {
      console.error("Error listing users:", error);
      return serverError(set, "Failed to list users");
    }
  })

  // POST /api/admin/invitations - Send an invitation email
  .post(
    "/invitations",
    async ({ user, body, set }) => {
      try {
        const emailTrimmed = (body.email || "").trim().toLowerCase();

        if (!emailTrimmed) {
          return badRequest(set, "Email is required");
        }

        if (!validateEmail(emailTrimmed)) {
          return badRequest(set, "Invalid email format");
        }

        const sanitizedEmail = sanitizeInput(emailTrimmed);

        const existingUser = await prisma.user.findFirst({
          where: { email: sanitizedEmail },
        });

        if (existingUser) {
          return badRequest(set, "A user with this email already exists");
        }

        const existingInvitation = await prisma.invitation.findFirst({
          where: {
            email: sanitizedEmail,
            status: "pending",
            expiresAt: { gt: new Date() },
          },
        });

        if (existingInvitation) {
          return badRequest(
            set,
            "A pending invitation already exists for this email. You can resend it instead.",
          );
        }

        const token = generateOpaqueToken();
        const locale = (body.locale || "en").trim().slice(0, 10);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const invitation = await prisma.invitation.create({
          data: {
            email: sanitizedEmail,
            token: hashOpaqueToken(token),
            status: "pending",
            expiresAt,
            invitedBy: user!.id,
            locale,
            isAdmin: body.is_admin || false,
          },
        });

        const inviterName =
          [user!.first_name, user!.last_name].filter(Boolean).join(" ") ||
          user!.email;
        await sendInvitationEmail(sanitizedEmail, token, inviterName, locale);

        set.status = 201;
        return {
          success: true,
          invitation: {
            id: invitation.id,
            email: invitation.email,
            status: invitation.status,
            is_admin: invitation.isAdmin,
            locale: invitation.locale,
            expires_at: invitation.expiresAt.toISOString(),
            created_at: invitation.createdAt.toISOString(),
            accepted_at: null,
          },
        };
      } catch (error) {
        console.error("Error sending invitation:", error);
        return serverError(set, "Failed to send invitation");
      }
    },
    {
      body: t.Object({
        email: t.String(),
        is_admin: t.Optional(t.Boolean()),
        locale: t.Optional(t.String()),
      }),
    },
  )

  // GET /api/admin/invitations - List all invitations
  .get("/invitations", async ({ set }) => {
    try {
      const invitations = await prisma.invitation.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          inviter: {
            select: { email: true, firstName: true, lastName: true },
          },
        },
      });

      const now = new Date();

      return {
        success: true,
        invitations: invitations.map((inv) => ({
          id: inv.id,
          email: inv.email,
          status:
            inv.status === "pending" && inv.expiresAt < now
              ? "expired"
              : inv.status,
          is_admin: inv.isAdmin,
          locale: inv.locale,
          expires_at: inv.expiresAt.toISOString(),
          created_at: inv.createdAt.toISOString(),
          accepted_at: inv.acceptedAt?.toISOString() || null,
          invited_by_email: inv.inviter.email,
          invited_by_name:
            [inv.inviter.firstName, inv.inviter.lastName]
              .filter(Boolean)
              .join(" ") || null,
        })),
      };
    } catch (error) {
      console.error("Error listing invitations:", error);
      return serverError(set, "Failed to list invitations");
    }
  })

  // POST /api/admin/invitations/:id/resend - Resend an invitation
  .post(
    "/invitations/:id/resend",
    async ({ user, params, set }) => {
      const id = parseInt(params.id, 10);
      if (isNaN(id)) return badRequest(set, "Invalid invitation ID");

      try {
        const invitation = await prisma.invitation.findFirst({ where: { id } });
        if (!invitation) return notFound(set, "Invitation not found");
        if (invitation.status !== "pending")
          return badRequest(set, "Can only resend pending invitations");

        const token = generateOpaqueToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await prisma.invitation.update({
          where: { id },
          data: { token: hashOpaqueToken(token), expiresAt },
        });

        const inviterName =
          [user!.first_name, user!.last_name].filter(Boolean).join(" ") ||
          user!.email;
        await sendInvitationEmail(
          invitation.email,
          token,
          inviterName,
          invitation.locale,
        );

        return { success: true, message: "Invitation resent" };
      } catch (error) {
        console.error("Error resending invitation:", error);
        return serverError(set, "Failed to resend invitation");
      }
    },
    { params: t.Object({ id: t.String() }) },
  )

  // DELETE /api/admin/invitations/:id - Revoke an invitation
  .delete(
    "/invitations/:id",
    async ({ params, set }) => {
      const id = parseInt(params.id, 10);
      if (isNaN(id)) return badRequest(set, "Invalid invitation ID");

      try {
        const invitation = await prisma.invitation.findFirst({ where: { id } });
        if (!invitation) return notFound(set, "Invitation not found");
        if (invitation.status !== "pending")
          return badRequest(set, "Can only revoke pending invitations");

        await prisma.invitation.update({
          where: { id },
          data: { status: "revoked" },
        });

        return { success: true, message: "Invitation revoked" };
      } catch (error) {
        console.error("Error revoking invitation:", error);
        return serverError(set, "Failed to revoke invitation");
      }
    },
    { params: t.Object({ id: t.String() }) },
  )

  // DELETE /api/admin/users/:id - Delete a user
  .delete(
    "/users/:id",
    async ({ user, params, set }) => {
      const userId = params.id;

      try {
        if (userId === user!.id)
          return badRequest(set, "Cannot delete your own account");

        const userToDelete = await prisma.user.findFirst({
          where: { id: userId },
        });
        if (!userToDelete) return notFound(set, "User not found");

        const userEmail = userToDelete.email;
        await prisma.user.delete({ where: { id: userId } });

        return {
          success: true,
          message: `User ${userEmail} deleted successfully`,
        };
      } catch (error) {
        console.error("Error deleting user:", error);
        return serverError(set, "Failed to delete user");
      }
    },
    { params: t.Object({ id: t.String() }) },
  );
