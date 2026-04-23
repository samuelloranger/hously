import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useBeszelIntegration,
  useUpdateBeszelIntegration,
} from "@/pages/settings/useIntegrations";
import { toast } from "sonner";
import { IntegrationSectionCard } from "@/pages/settings/_component/integrations/IntegrationSectionCard";
import { IntegrationUrlInput } from "@/pages/settings/_component/integrations/IntegrationUrlInput";

export function BeszelIntegrationSection() {
  const { data, isLoading } = useBeszelIntegration();
  return (
    <BeszelIntegrationSectionImpl
      key={data?.integration?.type ?? "pending"}
      data={data}
      isLoading={isLoading}
    />
  );
}

function BeszelIntegrationSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useBeszelIntegration>["data"];
  isLoading: boolean;
}) {
  const { t } = useTranslation("common");
  const saveMutation = useUpdateBeszelIntegration();

  const [websiteUrl, setWebsiteUrl] = useState(data?.integration?.website_url || "");
  const [email, setEmail] = useState(data?.integration?.email || "");
  const [password, setPassword] = useState("");
  const [enabled, setEnabled] = useState(Boolean(data?.integration?.enabled));

  const isDirty = useMemo(() => {
    if (!data?.integration) return false;
    return (
      websiteUrl !== (data.integration.website_url || "") ||
      email !== (data.integration.email || "") ||
      enabled !== Boolean(data.integration.enabled) ||
      password.trim().length > 0
    );
  }, [data, websiteUrl, email, enabled, password]);

  const handleCancel = () => {
    setWebsiteUrl(data?.integration.website_url || "");
    setEmail(data?.integration.email || "");
    setPassword("");
    setEnabled(Boolean(data?.integration.enabled));
  };

  const handleSave = () => {
    const payload: {
      website_url: string;
      email: string;
      enabled: boolean;
      password?: string;
    } = {
      website_url: websiteUrl,
      email,
      enabled,
    };
    if (password.trim()) payload.password = password.trim();

    saveMutation
      .mutateAsync(payload)
      .then(() => {
        setPassword("");
        toast.success(t("settings.integrations.saveSuccess"));
      })
      .catch(() => toast.error(t("settings.integrations.saveError")));
  };

  return (
    <IntegrationSectionCard
      title="Beszel"
      description={t("settings.integrations.beszel.help")}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/beszel.png"
    >
      <IntegrationUrlInput
        label={t("settings.integrations.beszel.websiteUrl")}
        value={websiteUrl}
        onChange={setWebsiteUrl}
        placeholder="http://beszel:8090"
      />
      <IntegrationUrlInput
        label={t("settings.integrations.beszel.email")}
        value={email}
        onChange={setEmail}
        placeholder="admin@example.com"
      />
      <IntegrationUrlInput
        label={t("settings.integrations.beszel.password")}
        value={password}
        onChange={setPassword}
        placeholder={
          data?.integration?.password_set
            ? t("settings.integrations.beszel.passwordSet")
            : ""
        }
      />
    </IntegrationSectionCard>
  );
}
