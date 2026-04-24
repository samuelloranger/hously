import { useMemo, useState } from "react";
import {
  useC411Integration,
  useUpdateC411Integration,
  useUpdateLaCaleIntegration,
  useUpdateTorr9Integration,
  useLaCaleIntegration,
  useTorr9Integration,
} from "@/pages/settings/useIntegrations";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { IntegrationUrlInput } from "@/pages/settings/_component/integrations/IntegrationUrlInput";
import { Switch } from "@/components/ui/switch";

type TrackerFormState = {
  enabled: boolean;
  flaresolverr_url: string;
  tracker_url: string;
  username: string;
  password: string;
};

type TrackerEditorProps = {
  title: string;
  logoUrl: string;
  description?: string;
  usernameLabel?: string;
  usernameHelp?: string;
  usernamePlaceholder: string;
  websiteLabel: string;
  websitePlaceholder: string;
  loading: boolean;
  saving: boolean;
  showFlaresolverr?: boolean;
  initial: Omit<TrackerFormState, "password">;
  onSave: (
    payload: Omit<TrackerFormState, "password"> & { password?: string },
  ) => Promise<unknown>;
};

function TrackerEditor({
  title,
  logoUrl,
  description,
  usernameLabel,
  usernameHelp,
  usernamePlaceholder,
  websiteLabel,
  websitePlaceholder,
  loading,
  saving,
  showFlaresolverr = true,
  initial,
  onSave,
}: TrackerEditorProps) {
  const { t } = useTranslation("common");
  const [state, setState] = useState<TrackerFormState>(() => ({
    ...initial,
    password: "",
  }));

  const isDirty = useMemo(
    () =>
      state.enabled !== initial.enabled ||
      state.flaresolverr_url !== initial.flaresolverr_url ||
      state.tracker_url !== initial.tracker_url ||
      state.username !== initial.username ||
      state.password !== "",
    [initial, state],
  );

  const handleCancel = () => {
    setState({
      ...initial,
      password: "",
    });
  };

  const handleSave = () => {
    onSave({
      enabled: state.enabled,
      flaresolverr_url: state.flaresolverr_url,
      tracker_url: state.tracker_url,
      username: state.username,
      password: state.password.trim() ? state.password : undefined,
    })
      .then(() => {
        setState((prev) => ({ ...prev, password: "" }));
        toast.success(t("settings.integrations.saveSuccess"));
      })
      .catch(() => toast.error(t("settings.integrations.saveError")));
  };

  const isBusy = loading || saving;

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <img
            src={logoUrl}
            alt={title}
            className="w-6 h-6 rounded object-contain"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {title}
          </h4>
        </div>
        <Switch
          checked={state.enabled}
          onCheckedChange={(next) =>
            setState((prev) => ({ ...prev, enabled: next }))
          }
        />
      </div>

      {description && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {description}
        </p>
      )}

      {showFlaresolverr && (
        <IntegrationUrlInput
          label={t("settings.integrations.trackers.flaresolverrUrl")}
          value={state.flaresolverr_url}
          onChange={(value) =>
            setState((prev) => ({ ...prev, flaresolverr_url: value }))
          }
          placeholder="http://192.168.50.30:8191"
        />
      )}

      <IntegrationUrlInput
        label={websiteLabel}
        value={state.tracker_url}
        onChange={(value) =>
          setState((prev) => ({ ...prev, tracker_url: value }))
        }
        placeholder={websitePlaceholder}
      />

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {usernameLabel || t("settings.integrations.trackers.username")}
        </label>
        <input
          type="text"
          value={state.username}
          onChange={(event) =>
            setState((prev) => ({ ...prev, username: event.target.value }))
          }
          placeholder={usernamePlaceholder}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
        />
        {usernameHelp && (
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {usernameHelp}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t("settings.integrations.trackers.password")}
        </label>
        <input
          type="password"
          value={state.password}
          onChange={(event) =>
            setState((prev) => ({ ...prev, password: event.target.value }))
          }
          placeholder={t("settings.integrations.trackers.passwordPlaceholder")}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
        />
      </div>

      <div className="flex items-center gap-3">
        {isDirty && (
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium mr-auto">
            {t("settings.integrations.unsavedChanges")}
          </span>
        )}
        <div className="flex items-center gap-3 ml-auto">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isBusy}
            className="px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isBusy}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-primary-600 hover:bg-primary-700"
          >
            {saving ? t("common.loading") : t("settings.integrations.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

type TrackerIntegrationConfig = {
  enabled?: boolean;
  flaresolverr_url?: string;
  tracker_url?: string;
  username?: string;
};

type TrackerSection = {
  key: string;
  integrationId: string | number;
  title: string;
  logoUrl: string;
  description?: string;
  usernameLabel?: string;
  usernameHelp?: string;
  usernamePlaceholder: string;
  websiteLabel: string;
  websitePlaceholder: string;
  loading: boolean;
  saving: boolean;
  showFlaresolverr?: boolean;
  initial: Omit<TrackerFormState, "password">;
  onSave: (
    payload: Omit<TrackerFormState, "password"> & { password?: string },
  ) => Promise<unknown>;
};

function toInitialState(integration: TrackerIntegrationConfig | undefined) {
  return {
    enabled: Boolean(integration?.enabled),
    flaresolverr_url: integration?.flaresolverr_url || "",
    tracker_url: integration?.tracker_url || "",
    username: integration?.username || "",
  };
}

export function TrackersIntegrationSection() {
  const { t } = useTranslation("common");
  const c411Query = useC411Integration();
  const c411Mutation = useUpdateC411Integration();
  const torr9Query = useTorr9Integration();
  const torr9Mutation = useUpdateTorr9Integration();
  const laCaleQuery = useLaCaleIntegration();
  const laCaleMutation = useUpdateLaCaleIntegration();

  const trackers: TrackerSection[] = [
    {
      key: "c411",
      integrationId: c411Query.data?.integration?.type ?? "pending",
      title: t("settings.integrations.trackers.providers.c411"),
      logoUrl: "/icons/c411.png",
      description: t("settings.integrations.trackers.providerHelp.c411"),
      usernameLabel: t("settings.integrations.trackers.username"),
      usernameHelp: t("settings.integrations.trackers.usernameHelp.c411"),
      usernamePlaceholder: t(
        "settings.integrations.trackers.usernamePlaceholder",
      ),
      websiteLabel: t("settings.integrations.trackers.trackerUrl"),
      websitePlaceholder: "https://c411.org",
      loading: c411Query.isLoading,
      saving: c411Mutation.isPending,
      initial: toInitialState(c411Query.data?.integration),
      onSave: (
        payload: Omit<TrackerFormState, "password"> & { password?: string },
      ) => c411Mutation.mutateAsync(payload),
    },
    {
      key: "torr9",
      integrationId: torr9Query.data?.integration?.type ?? "pending",
      title: t("settings.integrations.trackers.providers.torr9"),
      logoUrl: "/icons/torr9.png",
      usernamePlaceholder: t(
        "settings.integrations.trackers.usernamePlaceholder",
      ),
      websiteLabel: t("settings.integrations.trackers.trackerUrl"),
      websitePlaceholder: "https://www.torr9.com",
      loading: torr9Query.isLoading,
      saving: torr9Mutation.isPending,
      initial: toInitialState(torr9Query.data?.integration),
      onSave: (
        payload: Omit<TrackerFormState, "password"> & { password?: string },
      ) => torr9Mutation.mutateAsync(payload),
    },
    {
      key: "la-cale",
      integrationId: laCaleQuery.data?.integration?.type ?? "pending",
      title: t("settings.integrations.trackers.providers.la-cale"),
      logoUrl: "/icons/la-cale.png",
      usernamePlaceholder: t(
        "settings.integrations.trackers.usernamePlaceholder",
      ),
      websiteLabel: t("settings.integrations.trackers.trackerUrl"),
      websitePlaceholder: "https://la-cale.space",
      loading: laCaleQuery.isLoading,
      saving: laCaleMutation.isPending,
      showFlaresolverr: false,
      initial: toInitialState(laCaleQuery.data?.integration),
      onSave: (
        payload: Omit<TrackerFormState, "password"> & { password?: string },
      ) => laCaleMutation.mutateAsync(payload),
    },
  ] as const;

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {t("settings.integrations.trackers.title")}
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
          {t("settings.integrations.trackers.description")}
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
          {t("settings.integrations.trackers.disclaimer")}
        </p>
      </div>

      {trackers.map((tracker) => (
        <TrackerEditor
          key={`${tracker.key}-${tracker.integrationId}`}
          title={tracker.title}
          logoUrl={tracker.logoUrl}
          description={tracker.description}
          usernameLabel={tracker.usernameLabel}
          usernameHelp={tracker.usernameHelp}
          usernamePlaceholder={tracker.usernamePlaceholder}
          websiteLabel={tracker.websiteLabel}
          websitePlaceholder={tracker.websitePlaceholder}
          loading={tracker.loading}
          saving={tracker.saving}
          showFlaresolverr={tracker.showFlaresolverr}
          initial={tracker.initial}
          onSave={tracker.onSave}
        />
      ))}
    </div>
  );
}
