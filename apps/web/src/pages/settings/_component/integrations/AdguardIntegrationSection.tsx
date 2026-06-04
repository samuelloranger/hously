import { useTranslation } from "react-i18next";
import { useAdguardIntegration } from "@/pages/settings/useAdguardIntegration";
import { useUpdateAdguardIntegration } from "@/pages/settings/useUpdateAdguardIntegration";
import { IntegrationSectionCard } from "@/pages/settings/_component/integrations/IntegrationSectionCard";
import { CredentialIntegrationFields } from "@/pages/settings/_component/integrations/CredentialIntegrationFields";
import { useCredentialIntegrationForm } from "@/pages/settings/_component/integrations/useCredentialIntegrationForm";

export function AdguardIntegrationSection() {
  const { data, isLoading } = useAdguardIntegration();
  return (
    <AdguardIntegrationSectionImpl
      key={data?.integration?.type ?? "pending"}
      data={data}
      isLoading={isLoading}
    />
  );
}

function AdguardIntegrationSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useAdguardIntegration>["data"];
  isLoading: boolean;
}) {
  const { t } = useTranslation("common");
  const saveMutation = useUpdateAdguardIntegration();
  const form = useCredentialIntegrationForm({
    integration: data?.integration,
    save: saveMutation.mutateAsync,
  });

  return (
    <IntegrationSectionCard
      title="AdGuard Home"
      description={t("settings.integrations.adguard.help")}
      enabled={form.enabled}
      onEnabledChange={form.setEnabled}
      onCancel={form.handleCancel}
      onSave={form.handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={form.isDirty}
      logoUrl="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/adguard-home.png"
    >
      <CredentialIntegrationFields
        websiteUrlLabel={t("settings.integrations.adguard.websiteUrl")}
        websiteUrl={form.websiteUrl}
        onWebsiteUrlChange={form.setWebsiteUrl}
        websiteUrlPlaceholder="http://adguardhome:3000"
        usernameLabel={t("settings.integrations.adguard.username")}
        username={form.username}
        onUsernameChange={form.setUsername}
        passwordLabel={t("settings.integrations.adguard.password")}
        password={form.password}
        onPasswordChange={form.setPassword}
        passwordPlaceholder={t(
          "settings.integrations.adguard.passwordPlaceholder",
        )}
      />
    </IntegrationSectionCard>
  );
}
