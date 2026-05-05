import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useJellyfinIntegration,
  useUpdateJellyfinIntegration,
  useRegenerateJellyfinSyncToken,
  useJellyfinSyncTrigger,
} from "@/pages/settings/useIntegrations";
import { useUsers } from "@/pages/settings/useUsers";
import { toast } from "sonner";
import { IntegrationSectionCard } from "@/pages/settings/_component/integrations/IntegrationSectionCard";
import { IntegrationUrlInput } from "@/pages/settings/_component/integrations/IntegrationUrlInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, X } from "lucide-react";
import type { JellyfinUserMappingConfig } from "@hously/shared/types";

export function JellyfinIntegrationSection() {
  const { data, isLoading } = useJellyfinIntegration();
  return (
    <JellyfinIntegrationSectionImpl
      key={data?.integration?.type ?? "pending"}
      data={data}
      isLoading={isLoading}
    />
  );
}

function JellyfinIntegrationSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useJellyfinIntegration>["data"];
  isLoading: boolean;
}) {
  const { t } = useTranslation("common");
  const saveMutation = useUpdateJellyfinIntegration();
  const regenerateToken = useRegenerateJellyfinSyncToken();
  const triggerSync = useJellyfinSyncTrigger();
  const { data: usersData } = useUsers();

  const [websiteUrl, setWebsiteUrl] = useState(
    data?.integration?.website_url || "",
  );
  const [apiKey, setApiKey] = useState(data?.integration?.api_key || "");
  const [enabled, setEnabled] = useState(Boolean(data?.integration?.enabled));
  const [userMappings, setUserMappings] = useState<JellyfinUserMappingConfig[]>(
    data?.integration?.user_mappings ?? [],
  );
  const [displayedToken, setDisplayedToken] = useState<string | null>(null);

  const isDirty = useMemo(() => {
    if (!data?.integration) return false;
    return (
      websiteUrl !== (data.integration.website_url || "") ||
      apiKey !== (data.integration.api_key || "") ||
      enabled !== Boolean(data.integration.enabled)
    );
  }, [data, websiteUrl, apiKey, enabled]);

  const handleCancel = () => {
    setWebsiteUrl(data?.integration.website_url || "");
    setApiKey(data?.integration.api_key || "");
    setEnabled(Boolean(data?.integration.enabled));
    setUserMappings(data?.integration?.user_mappings ?? []);
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({
        website_url: websiteUrl,
        api_key: apiKey,
        enabled,
        user_mappings: userMappings,
      })
      .then(() => toast.success(t("settings.integrations.saveSuccess")))
      .catch(() => toast.error(t("settings.integrations.saveError")));
  };

  return (
    <IntegrationSectionCard
      title="Jellyfin"
      description={t("settings.integrations.jellyfin.help")}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/jellyfin.png"
    >
      <IntegrationUrlInput
        label={t("settings.integrations.jellyfin.websiteUrl")}
        value={websiteUrl}
        onChange={setWebsiteUrl}
        placeholder="https://jellyfin.example.com"
      />

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t("settings.integrations.jellyfin.apiKey")}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={t("settings.integrations.jellyfin.apiKeyPlaceholder")}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
        />
      </div>

      {/* Watchlist Sync */}
      <div className="mt-6 space-y-4 border-t border-neutral-200 dark:border-neutral-700 pt-4">
        <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          {t("settings.integrations.jellyfin.watchlistSync")}
        </h3>

        {/* Sync token */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t("settings.integrations.jellyfin.syncToken")}
          </label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={
                displayedToken
                  ? displayedToken
                  : data?.integration?.has_sync_token
                    ? "••••••••••••••••"
                    : t("settings.integrations.jellyfin.noSyncToken")
              }
              className="font-mono text-xs"
            />
            {displayedToken && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(displayedToken);
                  setDisplayedToken(null);
                  toast.success(t("common.copied"));
                }}
              >
                {t("common.copy")}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                regenerateToken.mutateAsync().then((data) => {
                  setDisplayedToken(data.sync_token);
                });
              }}
              disabled={regenerateToken.isPending}
            >
              {t("settings.integrations.jellyfin.regenerate")}
            </Button>
          </div>
        </div>

        {/* User mappings */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t("settings.integrations.jellyfin.userMappings")}
          </label>
          {userMappings.map((mapping, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <Input
                placeholder={t("settings.integrations.jellyfin.jellyfinUserId")}
                value={mapping.jellyfin_user_id}
                onChange={(e) => {
                  const updated = [...userMappings];
                  updated[idx] = {
                    ...updated[idx],
                    jellyfin_user_id: e.target.value,
                  };
                  setUserMappings(updated);
                }}
                className="font-mono text-xs"
              />
              <Select
                value={
                  mapping.hously_user_id.length > 0
                    ? String(mapping.hously_user_id)
                    : ""
                }
                onValueChange={(val) => {
                  const updated = [...userMappings];
                  updated[idx] = {
                    ...updated[idx],
                    hously_user_id: val,
                  };
                  setUserMappings(updated);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue
                    placeholder={t("settings.integrations.jellyfin.selectUser")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {usersData?.users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.first_name
                        ? `${u.first_name} ${u.last_name ?? ""}`.trim()
                        : u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                title={t("settings.integrations.jellyfin.syncUser")}
                disabled={triggerSync.isPending}
                onClick={() => triggerSync.mutate(mapping.jellyfin_user_id)}
              >
                <RefreshCw className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setUserMappings(userMappings.filter((_, i) => i !== idx))
                }
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setUserMappings([
                ...userMappings,
                { jellyfin_user_id: "", hously_user_id: "" },
              ])
            }
          >
            {t("settings.integrations.jellyfin.addMapping")}
          </Button>
        </div>

        {/* Sync All */}
        <Button
          variant="outline"
          onClick={() => triggerSync.mutate(null)}
          disabled={triggerSync.isPending}
        >
          <RefreshCw className="size-4 mr-2" />
          {t("settings.integrations.jellyfin.syncAll")}
        </Button>
      </div>
    </IntegrationSectionCard>
  );
}
