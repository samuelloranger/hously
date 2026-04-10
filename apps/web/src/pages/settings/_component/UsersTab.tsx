import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FormInput } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import {
  useAdminUsers,
  useDeleteUser,
  useInviteUser,
  useAdminInvitations,
  useResendInvitation,
  useRevokeInvitation,
} from "@/hooks/admin/useAdmin";
import { useCurrentUser } from "@/hooks/auth/useAuth";
import { formatDateTime } from "@hously/shared/utils";
import { LoadingState } from "@/components/LoadingState";

interface InviteFormData {
  email: string;
  is_admin: boolean;
  locale: string;
}

export function UsersTab() {
  const { t, i18n } = useTranslation("common");
  const inviteMutation = useInviteUser();
  const deleteMutation = useDeleteUser();
  const resendMutation = useResendInvitation();
  const revokeMutation = useRevokeInvitation();
  const { data: currentUser } = useCurrentUser();
  const {
    data: usersData,
    isLoading: usersLoading,
    error: usersError,
  } = useAdminUsers();
  const { data: invitationsData, isLoading: invitationsLoading } =
    useAdminInvitations();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormData>({
    defaultValues: {
      email: "",
      is_admin: false,
      locale: "en",
    },
  });

  const onSubmit = async (data: InviteFormData) => {
    try {
      const result = await inviteMutation.mutateAsync({
        email: data.email.trim(),
        is_admin: data.is_admin,
        locale: data.locale,
      });

      if (result.success) {
        reset();
        toast.success(t("settings.users.inviteSuccess"));
      }
    } catch (error: any) {
      toast.error(
        error?.error ||
          t("settings.users.inviteError") ||
          "Failed to send invitation",
      );
    }
  };

  const handleDeleteUser = async (userId: number, userEmail: string) => {
    if (!confirm(t("settings.users.deleteConfirm", { email: userEmail }))) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(userId);
      toast.success(t("settings.users.deleteSuccess"));
    } catch (error: any) {
      toast.error(
        error?.error ||
          t("settings.users.deleteError") ||
          "Failed to delete user",
      );
    }
  };

  const handleResendInvitation = async (id: number) => {
    try {
      await resendMutation.mutateAsync(id);
      toast.success(t("settings.users.resendSuccess"));
    } catch (error: any) {
      toast.error(
        error?.error ||
          t("settings.users.resendError") ||
          "Failed to resend invitation",
      );
    }
  };

  const handleRevokeInvitation = async (id: number, email: string) => {
    if (!confirm(t("settings.users.revokeConfirm", { email }))) {
      return;
    }

    try {
      await revokeMutation.mutateAsync(id);
      toast.success(t("settings.users.revokeSuccess"));
    } catch (error: any) {
      toast.error(
        error?.error ||
          t("settings.users.revokeError") ||
          "Failed to revoke invitation",
      );
    }
  };

  const formatDisplayName = (user: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  }) => {
    if (user.first_name || user.last_name) {
      return [user.first_name, user.last_name].filter(Boolean).join(" ");
    }
    return user.email;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            {t("settings.users.statusPending")}
          </span>
        );
      case "accepted":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            {t("settings.users.statusAccepted")}
          </span>
        );
      case "revoked":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            {t("settings.users.statusRevoked")}
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200">
            {t("settings.users.statusExpired")}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="animate-in fade-in slide-in-from-right-4 duration-300"
      key="users-tab"
    >
      <div className="space-y-6">
        {/* Users List */}
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
          <h2 className="text-lg font-semibold mb-1.5 text-neutral-900 dark:text-neutral-100">
            {t("settings.users.listTitle")}
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            {t("settings.users.listDescription")}
          </p>

          {usersLoading ? (
            <LoadingState />
          ) : usersError ? (
            <div className="text-red-600 dark:text-red-400">
              {t("settings.users.loadError") || "Failed to load users"}
            </div>
          ) : usersData?.users && usersData.users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {t("settings.users.email")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {t("settings.users.name")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {t("settings.users.role")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {t("settings.users.createdAt")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {t("settings.users.lastLogin")}
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {t("settings.users.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usersData.users.map((user) => {
                    const isCurrentUser = currentUser?.id === user.id;
                    const displayName = formatDisplayName(user);
                    const initials =
                      [user.first_name, user.last_name]
                        .filter(Boolean)
                        .map((n) => n![0].toUpperCase())
                        .join("") || user.email[0].toUpperCase();
                    return (
                      <tr
                        key={user.id}
                        className="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
                      >
                        <td className="py-3 px-4 text-sm text-neutral-900 dark:text-neutral-100">
                          {user.email}
                        </td>
                        <td className="py-3 px-4 text-sm text-neutral-900 dark:text-neutral-100">
                          <div className="flex items-center gap-2.5">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-400 text-xs font-semibold flex-shrink-0">
                              {initials}
                            </span>
                            {displayName}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {user.is_admin ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                              {t("settings.users.admin")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200">
                              {t("settings.users.user")}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-neutral-600 dark:text-neutral-400">
                          {user.created_at
                            ? formatDateTime(user.created_at, i18n.language)
                            : "-"}
                        </td>
                        <td className="py-3 px-4 text-sm text-neutral-600 dark:text-neutral-400">
                          {user.last_login
                            ? formatDateTime(user.last_login, i18n.language)
                            : "-"}
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          {isCurrentUser ? (
                            <span className="text-neutral-400 dark:text-neutral-500 text-xs">
                              {t("settings.users.currentUser")}
                            </span>
                          ) : (
                            <button
                              onClick={() =>
                                handleDeleteUser(user.id, user.email)
                              }
                              disabled={deleteMutation.isPending}
                              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {deleteMutation.isPending
                                ? t("settings.users.deleting") || "Deleting..."
                                : t("settings.users.delete") || "Delete"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
              {t("settings.users.noUsers") || "No users found"}
            </div>
          )}
        </div>

        {/* Pending Invitations */}
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
          <h2 className="text-lg font-semibold mb-1.5 text-neutral-900 dark:text-neutral-100">
            {t("settings.users.pendingInvitations")}
          </h2>

          {invitationsLoading ? (
            <LoadingState />
          ) : invitationsData?.invitations &&
            invitationsData.invitations.length > 0 ? (
            <div className="overflow-x-auto mt-4">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {t("settings.users.email")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {t("settings.users.status")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {t("settings.users.invitedAt")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {t("settings.users.expiresAt")}
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {t("settings.users.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invitationsData.invitations.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-neutral-900 dark:text-neutral-100">
                        {inv.email}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {getStatusBadge(inv.status)}
                      </td>
                      <td className="py-3 px-4 text-sm text-neutral-600 dark:text-neutral-400">
                        {formatDateTime(inv.created_at, i18n.language)}
                      </td>
                      <td className="py-3 px-4 text-sm text-neutral-600 dark:text-neutral-400">
                        {formatDateTime(inv.expires_at, i18n.language)}
                      </td>
                      <td className="py-3 px-4 text-sm text-right">
                        {inv.status === "pending" && (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleResendInvitation(inv.id)}
                              disabled={resendMutation.isPending}
                              className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {resendMutation.isPending
                                ? t("settings.users.resending") ||
                                  "Resending..."
                                : t("settings.users.resend") || "Resend"}
                            </button>
                            <button
                              onClick={() =>
                                handleRevokeInvitation(inv.id, inv.email)
                              }
                              disabled={revokeMutation.isPending}
                              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {revokeMutation.isPending
                                ? t("settings.users.revoking") || "Revoking..."
                                : t("settings.users.revoke") || "Revoke"}
                            </button>
                          </div>
                        )}
                        {inv.status === "expired" && (
                          <button
                            onClick={() => handleResendInvitation(inv.id)}
                            disabled={resendMutation.isPending}
                            className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {resendMutation.isPending
                              ? t("settings.users.resending") || "Resending..."
                              : t("settings.users.resend") || "Resend"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
              {t("settings.users.noPendingInvitations") || "No invitations"}
            </div>
          )}
        </div>

        {/* Invite User Form */}
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
          <h2 className="text-lg font-semibold mb-1.5 text-neutral-900 dark:text-neutral-100">
            {t("settings.users.inviteTitle")}
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            {t("settings.users.inviteDescription")}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormInput
              {...register("email", {
                required: true,
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: t("settings.users.invalidEmail") || "Invalid email",
                },
              })}
              type="email"
              placeholder={t("settings.users.emailPlaceholder") || "Email"}
              error={
                errors.email
                  ? errors.email.type === "required"
                    ? t("settings.users.emailRequired") || "Email is required"
                    : errors.email.message
                  : undefined
              }
            />

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                {t("settings.users.locale")}
              </label>
              <select
                {...register("locale")}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md text-neutral-900 dark:text-white bg-white dark:bg-neutral-700 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="en">English</option>
                <option value="fr">Français</option>
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_admin"
                {...register("is_admin")}
                className="w-4 h-4 text-primary-600 bg-neutral-100 border-neutral-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-neutral-800 focus:ring-2 dark:bg-neutral-700 dark:border-neutral-600"
              />
              <label
                htmlFor="is_admin"
                className="ml-2 text-sm text-neutral-700 dark:text-neutral-300"
              >
                {t("settings.users.isAdmin")}
              </label>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending
                  ? t("settings.users.inviting") || "Sending..."
                  : t("settings.users.inviteButton") || "Send Invitation"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
