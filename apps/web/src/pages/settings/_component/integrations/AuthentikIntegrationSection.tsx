import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import {
  useAuthentikIntegration,
  useUpdateAuthentikIntegration,
} from "@/pages/settings/useIntegrations";
import { IntegrationSectionCard } from "@/pages/settings/_component/integrations/IntegrationSectionCard";
import { IntegrationUrlInput } from "@/pages/settings/_component/integrations/IntegrationUrlInput";

export function AuthentikIntegrationSection() {
  const { data, isLoading } = useAuthentikIntegration();
  return (
    <AuthentikIntegrationSectionImpl
      key={data?.integration?.type ?? "pending"}
      data={data}
      isLoading={isLoading}
    />
  );
}

function AuthentikIntegrationSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useAuthentikIntegration>["data"];
  isLoading: boolean;
}) {
  const { t } = useTranslation("common");
  const saveMutation = useUpdateAuthentikIntegration();

  const [issuerUrl, setIssuerUrl] = useState(
    data?.integration?.issuer_url || "",
  );
  const [clientId, setClientId] = useState(data?.integration?.client_id || "");
  const [clientSecret, setClientSecret] = useState("");
  const [enabled, setEnabled] = useState(Boolean(data?.integration?.enabled));

  const secretIsSet = Boolean(data?.integration?.client_secret_set);
  const apiBase = import.meta.env.VITE_API_URL || window.location.origin;
  const redirectUri = `${apiBase}/api/auth/oauth2/callback/authentik`;

  const isDirty = useMemo(() => {
    if (!data?.integration) return false;
    return (
      issuerUrl !== (data.integration.issuer_url || "") ||
      clientId !== (data.integration.client_id || "") ||
      clientSecret !== "" ||
      enabled !== Boolean(data.integration.enabled)
    );
  }, [data, issuerUrl, clientId, clientSecret, enabled]);

  const handleCancel = () => {
    setIssuerUrl(data?.integration?.issuer_url || "");
    setClientId(data?.integration?.client_id || "");
    setClientSecret("");
    setEnabled(Boolean(data?.integration?.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({
        issuer_url: issuerUrl,
        client_id: clientId,
        ...(clientSecret ? { client_secret: clientSecret } : {}),
        enabled,
      })
      .then(() => {
        setClientSecret("");
        toast.success(t("settings.integrations.saveSuccess"));
      })
      .catch(() => toast.error(t("settings.integrations.saveError")));
  };

  return (
    <IntegrationSectionCard
      title="Authentik"
      description={t("settings.integrations.authentik.help")}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/authentik.png"
    >
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t("settings.integrations.authentik.redirectUri")}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={redirectUri}
            className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-mono text-sm cursor-default"
          />
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(redirectUri);
              toast.success(t("common.copied"));
            }}
            className="p-2 rounded-lg border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 transition-colors"
          >
            <Copy className="size-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {t("settings.integrations.authentik.redirectUriHelp")}
        </p>
      </div>

      <IntegrationUrlInput
        label={t("settings.integrations.authentik.issuerUrl")}
        value={issuerUrl}
        onChange={setIssuerUrl}
        placeholder="https://authentik.example.com/application/o/hously/"
      />

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t("settings.integrations.authentik.clientId")}
        </label>
        <input
          type="text"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder={t("settings.integrations.authentik.clientIdPlaceholder")}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t("settings.integrations.authentik.clientSecret")}
        </label>
        <input
          type="password"
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          placeholder={
            secretIsSet
              ? t("settings.integrations.authentik.clientSecretPlaceholderSet")
              : t("settings.integrations.authentik.clientSecretPlaceholder")
          }
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono text-sm"
        />
      </div>
    </IntegrationSectionCard>
  );
}
