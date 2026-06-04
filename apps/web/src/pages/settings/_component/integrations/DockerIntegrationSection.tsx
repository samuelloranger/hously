import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { IntegrationSectionCard } from "@/pages/settings/_component/integrations/IntegrationSectionCard";
import { useDockerIntegration } from "@/pages/settings/useDockerIntegration";
import { useUpdateDockerIntegration } from "@/pages/settings/useUpdateDockerIntegration";

const DOCKER_ICON =
  "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/docker.png";

function TextField({
  label,
  value,
  onChange,
  placeholder,
  description,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  description?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-300 mb-2">
        {label}
      </label>
      {description && (
        <p className="mb-2 text-xs text-neutral-400">{description}</p>
      )}
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2 border rounded-lg bg-neutral-900 text-white transition-colors border-neutral-600 focus:ring-primary-500"
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  description,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  description?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-300 mb-2">
        {label}
      </label>
      {description && (
        <p className="mb-2 text-xs text-neutral-400">{description}</p>
      )}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={5}
        className="w-full px-4 py-2 border rounded-lg bg-neutral-900 text-white transition-colors border-neutral-600 focus:ring-primary-500 font-mono text-sm"
      />
    </div>
  );
}

const formatIconNameOverrides = (overrides: Record<string, string>): string =>
  Object.entries(overrides)
    .map(([containerName, iconName]) => `${containerName}=${iconName}`)
    .join("\n");

const parseIconNameOverrides = (value: string): Record<string, string> =>
  Object.fromEntries(
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        if (separatorIndex === -1) return [line, ""];
        return [
          line.slice(0, separatorIndex).trim(),
          line.slice(separatorIndex + 1).trim(),
        ];
      })
      .filter(([containerName, iconName]) => containerName && iconName),
  );

export function DockerIntegrationSection() {
  const { data, isLoading } = useDockerIntegration();
  return (
    <DockerIntegrationSectionImpl
      key={data?.integration?.type ?? "pending"}
      data={data}
      isLoading={isLoading}
    />
  );
}

function DockerIntegrationSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useDockerIntegration>["data"];
  isLoading: boolean;
}) {
  const { t } = useTranslation("common");
  const saveMutation = useUpdateDockerIntegration();

  const [socketPath, setSocketPath] = useState(
    data?.integration?.socket_path || "/var/run/docker.sock",
  );
  const [composeProject, setComposeProject] = useState(
    data?.integration?.compose_project || "",
  );
  const [iconNameOverrides, setIconNameOverrides] = useState(
    formatIconNameOverrides(data?.integration?.icon_name_overrides || {}),
  );
  const [enabled, setEnabled] = useState(Boolean(data?.integration?.enabled));

  const isDirty = useMemo(() => {
    if (!data?.integration) return false;
    return (
      socketPath !== (data.integration.socket_path || "/var/run/docker.sock") ||
      composeProject !== (data.integration.compose_project || "") ||
      iconNameOverrides !==
        formatIconNameOverrides(data.integration.icon_name_overrides || {}) ||
      enabled !== Boolean(data.integration.enabled)
    );
  }, [data, socketPath, composeProject, iconNameOverrides, enabled]);

  const handleCancel = () => {
    setSocketPath(data?.integration.socket_path || "/var/run/docker.sock");
    setComposeProject(data?.integration.compose_project || "");
    setIconNameOverrides(
      formatIconNameOverrides(data?.integration.icon_name_overrides || {}),
    );
    setEnabled(Boolean(data?.integration.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({
        socket_path: socketPath,
        compose_project: composeProject,
        icon_name_overrides: parseIconNameOverrides(iconNameOverrides),
        enabled,
      })
      .then(() => toast.success(t("settings.integrations.saveSuccess")))
      .catch(() => toast.error(t("settings.integrations.saveError")));
  };

  return (
    <IntegrationSectionCard
      title="Docker"
      description={t("settings.integrations.docker.help")}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl={DOCKER_ICON}
    >
      <TextField
        label={t("settings.integrations.docker.socketPath")}
        value={socketPath}
        onChange={setSocketPath}
        placeholder="/var/run/docker.sock or http://docker-proxy-ro:2375"
        description={t("settings.integrations.docker.socketPathHelp")}
      />
      <TextField
        label={t("settings.integrations.docker.composeProject")}
        value={composeProject}
        onChange={setComposeProject}
        placeholder="hously"
        description={t("settings.integrations.docker.composeProjectHelp")}
      />
      <TextAreaField
        label={t("settings.integrations.docker.iconNameOverrides")}
        value={iconNameOverrides}
        onChange={setIconNameOverrides}
        placeholder={"hously-dev-db=postgres\nhously-dev-redis=redis"}
        description={t("settings.integrations.docker.iconNameOverridesHelp")}
      />
    </IntegrationSectionCard>
  );
}
