import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useBeszelPlugin, useUpdateBeszelPlugin } from "@/hooks/usePlugins";
import { toast } from "sonner";
import { PluginSectionCard } from "@/pages/settings/_component/plugins/PluginSectionCard";
import { PluginUrlInput } from "@/pages/settings/_component/plugins/PluginUrlInput";

export function BeszelPluginSection() {
  const { data, isLoading } = useBeszelPlugin();
  return (
    <BeszelPluginSectionImpl
      key={data?.plugin?.type ?? "pending"}
      data={data}
      isLoading={isLoading}
    />
  );
}

function BeszelPluginSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useBeszelPlugin>["data"];
  isLoading: boolean;
}) {
  const { t } = useTranslation("common");
  const saveMutation = useUpdateBeszelPlugin();

  const [websiteUrl, setWebsiteUrl] = useState(data?.plugin?.website_url || "");
  const [email, setEmail] = useState(data?.plugin?.email || "");
  const [password, setPassword] = useState("");
  const [enabled, setEnabled] = useState(Boolean(data?.plugin?.enabled));

  const isDirty = useMemo(() => {
    if (!data?.plugin) return false;
    return (
      websiteUrl !== (data.plugin.website_url || "") ||
      email !== (data.plugin.email || "") ||
      enabled !== Boolean(data.plugin.enabled) ||
      password.trim().length > 0
    );
  }, [data, websiteUrl, email, enabled, password]);

  const handleCancel = () => {
    setWebsiteUrl(data?.plugin.website_url || "");
    setEmail(data?.plugin.email || "");
    setPassword("");
    setEnabled(Boolean(data?.plugin.enabled));
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
        toast.success(t("settings.plugins.saveSuccess"));
      })
      .catch(() => toast.error(t("settings.plugins.saveError")));
  };

  return (
    <PluginSectionCard
      title="Beszel"
      description={t("settings.plugins.beszel.help")}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/beszel.png"
      configuredValue={data?.plugin?.website_url || undefined}
    >
      <PluginUrlInput
        label={t("settings.plugins.beszel.websiteUrl")}
        value={websiteUrl}
        onChange={setWebsiteUrl}
        placeholder="http://beszel:8090"
      />
      <PluginUrlInput
        label={t("settings.plugins.beszel.email")}
        value={email}
        onChange={setEmail}
        placeholder="admin@example.com"
      />
      <PluginUrlInput
        label={t("settings.plugins.beszel.password")}
        value={password}
        onChange={setPassword}
        placeholder={
          data?.plugin?.password_set
            ? t("settings.plugins.beszel.passwordSet")
            : ""
        }
      />
    </PluginSectionCard>
  );
}
