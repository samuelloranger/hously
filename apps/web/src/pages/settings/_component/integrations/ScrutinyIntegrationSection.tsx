import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useScrutinyIntegration,
  useUpdateScrutinyIntegration,
} from "@/pages/settings/useIntegrations";
import { toast } from "sonner";
import { IntegrationSectionCard } from "@/pages/settings/_component/integrations/IntegrationSectionCard";
import { IntegrationUrlInput } from "@/pages/settings/_component/integrations/IntegrationUrlInput";

export function ScrutinyIntegrationSection() {
  const { data, isLoading } = useScrutinyIntegration();
  return (
    <ScrutinyIntegrationSectionImpl
      key={data?.integration?.type ?? "pending"}
      data={data}
      isLoading={isLoading}
    />
  );
}

function ScrutinyIntegrationSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useScrutinyIntegration>["data"];
  isLoading: boolean;
}) {
  const { t } = useTranslation("common");
  const saveMutation = useUpdateScrutinyIntegration();

  const [websiteUrl, setWebsiteUrl] = useState(data?.integration?.website_url || "");
  const [enabled, setEnabled] = useState(Boolean(data?.integration?.enabled));

  const isDirty = useMemo(() => {
    if (!data?.integration) return false;
    return (
      websiteUrl !== (data.integration.website_url || "") ||
      enabled !== Boolean(data.integration.enabled)
    );
  }, [data, websiteUrl, enabled]);

  const handleCancel = () => {
    setWebsiteUrl(data?.integration.website_url || "");
    setEnabled(Boolean(data?.integration.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({ website_url: websiteUrl, enabled })
      .then(() => toast.success(t("settings.integrations.saveSuccess")))
      .catch(() => toast.error(t("settings.integrations.saveError")));
  };

  return (
    <IntegrationSectionCard
      title="Scrutiny"
      description={t("settings.integrations.scrutiny.help")}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/scrutiny.png"
    >
      <IntegrationUrlInput
        label={t("settings.integrations.scrutiny.websiteUrl")}
        value={websiteUrl}
        onChange={setWebsiteUrl}
        placeholder="http://scrutiny:8080"
      />
    </IntegrationSectionCard>
  );
}
