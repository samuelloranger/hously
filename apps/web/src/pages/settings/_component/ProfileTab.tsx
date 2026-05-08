import { useTranslation } from "react-i18next";
import { UserRound } from "lucide-react";
import { PasskeysSection } from "@/pages/settings/_component/PasskeysSection";
import { ProfileForm } from "@/pages/settings/_component/ProfileForm";
import { SettingsPageHeader } from "@/pages/settings/_component/SettingsPageHeader";

export function ProfileTab() {
  const { t } = useTranslation("common");

  return (
    <div
      className="animate-in fade-in slide-in-from-left-4 duration-300 space-y-6"
      key="profile-tab"
    >
      <SettingsPageHeader
        icon={UserRound}
        title={t("settings.profile.title")}
        description={t("settings.profile.description")}
      />
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
        <ProfileForm />
      </div>
      <PasskeysSection />
    </div>
  );
}
