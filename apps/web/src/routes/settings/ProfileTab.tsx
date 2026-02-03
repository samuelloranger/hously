import { useTranslation } from "react-i18next";
import { ProfileForm } from "./components/ProfileForm";

export function ProfileTab() {
  const { t } = useTranslation("common");

  return (
    <div
      className="animate-in fade-in slide-in-from-left-4 duration-300"
      key="profile-tab"
    >
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2 text-neutral-900 dark:text-neutral-100">
          {t("settings.profile.title")}
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          {t("settings.profile.description")}
        </p>

        <ProfileForm />
      </div>
    </div>
  );
}
