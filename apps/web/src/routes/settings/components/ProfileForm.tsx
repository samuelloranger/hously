import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useCurrentUser } from "../../../features/auth/hooks";
import { useUpdateProfile, useChangePassword } from "../../../features/users/hooks";

interface ProfileFormData {
  first_name: string;
  last_name: string;
}

interface PasswordFormData {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export function ProfileForm() {
  const { t } = useTranslation("common");
  const { data: currentUser } = useCurrentUser();
  const updateProfileMutation = useUpdateProfile();
  const changePasswordMutation = useChangePassword();

  // Profile form
  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    reset: resetProfile,
  } = useForm<ProfileFormData>({
    defaultValues: {
      first_name: "",
      last_name: "",
    },
  });

  // Password form
  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    watch,
    formState: { errors: passwordErrors },
  } = useForm<PasswordFormData>({
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  const newPassword = watch("new_password");

  // Initialize profile form when user data loads
  useEffect(() => {
    if (currentUser) {
      resetProfile({
        first_name: currentUser.first_name || "",
        last_name: currentUser.last_name || "",
      });
    }
  }, [currentUser, resetProfile]);

  const onProfileSubmit = async (data: ProfileFormData) => {
    // Build update payload - only include fields that changed
    const updates: {
      first_name?: string;
      last_name?: string;
    } = {};

    if (data.first_name !== (currentUser?.first_name || "")) {
      updates.first_name = data.first_name;
    }

    if (data.last_name !== (currentUser?.last_name || "")) {
      updates.last_name = data.last_name;
    }

    // Check if there are any updates
    if (Object.keys(updates).length === 0) {
      toast.info(t("settings.profile.noChanges") || "No changes to save");
      return;
    }

    try {
      await updateProfileMutation.mutateAsync(updates);
      toast.success(t("settings.profile.updateSuccess"));
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error((error as any)?.message || t("settings.profile.updateError"));
    }
  };

  const onPasswordSubmit = async (data: PasswordFormData) => {
    try {
      await changePasswordMutation.mutateAsync({
        current_password: data.current_password,
        new_password: data.new_password,
      });
      resetPassword();
      toast.success(t("settings.profile.passwordUpdateSuccess") || "Password updated successfully");
    } catch (error) {
      console.error("Password change error:", error);
      toast.error((error as any)?.message || t("settings.profile.passwordUpdateError") || "Failed to update password");
    }
  };

  return (
    <div className="space-y-8">
      {/* Profile Section */}
      <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-6">
        <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
          {t("settings.profile.personalInfo") || "Personal Information"}
        </h3>

        {/* Email (Read-only) */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t("settings.profile.email")}
          </label>
          <input
            type="email"
            value={currentUser?.email || ""}
            disabled
            className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-500 dark:text-neutral-400 cursor-not-allowed"
          />
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {t("settings.profile.emailReadOnly")}
          </p>
        </div>

        {/* First Name */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t("settings.profile.firstName")}
          </label>
          <input
            type="text"
            {...registerProfile("first_name")}
            placeholder={t("settings.profile.firstNamePlaceholder")}
            className="w-full px-4 py-2 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Last Name */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t("settings.profile.lastName")}
          </label>
          <input
            type="text"
            {...registerProfile("last_name")}
            placeholder={t("settings.profile.lastNamePlaceholder")}
            className="w-full px-4 py-2 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={updateProfileMutation.isPending}
          className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {updateProfileMutation.isPending
            ? t("settings.profile.saving")
            : t("settings.profile.saveChanges")}
        </button>
      </form>

      {/* Divider */}
      <div className="border-t border-neutral-200 dark:border-neutral-700" />

      {/* Password Section */}
      <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className="space-y-6">
        <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
          {t("settings.profile.changePassword") || "Change Password"}
        </h3>

        {/* Current Password */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t("settings.profile.currentPassword") || "Current Password"}
          </label>
          <input
            type="password"
            {...registerPassword("current_password", {
              required: t("settings.profile.currentPasswordRequired") || "Current password is required",
            })}
            placeholder={t("settings.profile.currentPasswordPlaceholder") || "Enter your current password"}
            className="w-full px-4 py-2 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {passwordErrors.current_password && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {passwordErrors.current_password.message}
            </p>
          )}
        </div>

        {/* New Password */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t("settings.profile.newPassword")}
          </label>
          <input
            type="password"
            {...registerPassword("new_password", {
              required: t("settings.profile.newPasswordRequired") || "New password is required",
              minLength: {
                value: 8,
                message:
                  t("settings.profile.passwordMinLength") ||
                  "Password must be at least 8 characters",
              },
            })}
            placeholder={t("settings.profile.newPasswordPlaceholder")}
            className="w-full px-4 py-2 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {passwordErrors.new_password && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {passwordErrors.new_password.message}
            </p>
          )}
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {t("settings.profile.passwordHelp")}
          </p>
        </div>

        {/* Confirm New Password */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t("settings.profile.confirmPassword") || "Confirm New Password"}
          </label>
          <input
            type="password"
            {...registerPassword("confirm_password", {
              required: t("settings.profile.confirmPasswordRequired") || "Please confirm your new password",
              validate: (value) =>
                value === newPassword ||
                t("settings.profile.passwordMismatch") ||
                "Passwords do not match",
            })}
            placeholder={t("settings.profile.confirmPasswordPlaceholder") || "Confirm your new password"}
            className="w-full px-4 py-2 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {passwordErrors.confirm_password && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {passwordErrors.confirm_password.message}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={changePasswordMutation.isPending}
          className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {changePasswordMutation.isPending
            ? t("settings.profile.saving")
            : t("settings.profile.updatePassword") || "Update Password"}
        </button>
      </form>
    </div>
  );
}
