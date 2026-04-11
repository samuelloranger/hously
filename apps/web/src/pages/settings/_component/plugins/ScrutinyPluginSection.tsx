import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useScrutinyPlugin,
  useUpdateScrutinyPlugin,
} from "@/hooks/plugins/usePlugins";
import { toast } from "sonner";
import { PluginSectionCard } from "@/pages/settings/_component/plugins/PluginSectionCard";
import { PluginUrlInput } from "@/pages/settings/_component/plugins/PluginUrlInput";

export function ScrutinyPluginSection() {
  const { data, isLoading } = useScrutinyPlugin();
  return (
    <ScrutinyPluginSectionImpl
      key={data?.plugin?.type ?? "pending"}
      data={data}
      isLoading={isLoading}
    />
  );
}

function ScrutinyPluginSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useScrutinyPlugin>["data"];
  isLoading: boolean;
}) {
  const { t } = useTranslation("common");
  const saveMutation = useUpdateScrutinyPlugin();

  const [websiteUrl, setWebsiteUrl] = useState(data?.plugin?.website_url || "");
  const [enabled, setEnabled] = useState(Boolean(data?.plugin?.enabled));

  const isDirty = useMemo(() => {
    if (!data?.plugin) return false;
    return (
      websiteUrl !== (data.plugin.website_url || "") ||
      enabled !== Boolean(data.plugin.enabled)
    );
  }, [data, websiteUrl, enabled]);

  const handleCancel = () => {
    setWebsiteUrl(data?.plugin.website_url || "");
    setEnabled(Boolean(data?.plugin.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({ website_url: websiteUrl, enabled })
      .then(() => toast.success(t("settings.plugins.saveSuccess")))
      .catch(() => toast.error(t("settings.plugins.saveError")));
  };

  return (
    <PluginSectionCard
      title="Scrutiny"
      description={t("settings.plugins.scrutiny.help")}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/scrutiny.png"
    >
      <PluginUrlInput
        label={t("settings.plugins.scrutiny.websiteUrl")}
        value={websiteUrl}
        onChange={setWebsiteUrl}
        placeholder="http://scrutiny:8080"
      />
    </PluginSectionCard>
  );
}
