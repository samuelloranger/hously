import { useEffect, useMemo, useState } from 'react';
import {
  useC411Plugin,
  useG3miniPlugin,
  useTorr9Plugin,
  useUpdateC411Plugin,
  useUpdateG3miniPlugin,
  useUpdateTorr9Plugin,
  useUpdateYggPlugin,
  useYggPlugin,
} from '@hously/shared';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../../lib/utils';
import { PluginUrlInput } from './PluginUrlInput';

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
  trackerLabel: string;
  websiteLabel: string;
  websitePlaceholder: string;
  loading: boolean;
  saving: boolean;
  initial: Omit<TrackerFormState, 'password'>;
  onSave: (payload: Omit<TrackerFormState, 'password'> & { password?: string }) => Promise<unknown>;
};

function TrackerEditor({
  title,
  logoUrl,
  trackerLabel,
  websiteLabel,
  websitePlaceholder,
  loading,
  saving,
  initial,
  onSave,
}: TrackerEditorProps) {
  const { t } = useTranslation('common');
  const [state, setState] = useState<TrackerFormState>({
    ...initial,
    password: '',
  });

  useEffect(() => {
    setState({
      ...initial,
      password: '',
    });
  }, [initial]);

  const isDirty = useMemo(
    () =>
      state.enabled !== initial.enabled ||
      state.flaresolverr_url !== initial.flaresolverr_url ||
      state.tracker_url !== initial.tracker_url ||
      state.username !== initial.username ||
      state.password !== '',
    [initial, state]
  );

  const handleCancel = () => {
    setState({
      ...initial,
      password: '',
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
        setState(prev => ({ ...prev, password: '' }));
        toast.success(t('settings.plugins.saveSuccess'));
      })
      .catch(() => toast.error(t('settings.plugins.saveError')));
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
            onError={event => {
              event.currentTarget.style.display = 'none';
            }}
          />
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</h4>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={state.enabled}
          onClick={() => setState(prev => ({ ...prev, enabled: !prev.enabled }))}
          className={cn(
            'relative inline-flex h-6 w-11 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
            state.enabled ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700'
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              state.enabled ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </button>
      </div>

      <PluginUrlInput
        label={t('settings.plugins.ygg.flaresolverrUrl')}
        value={state.flaresolverr_url}
        onChange={value => setState(prev => ({ ...prev, flaresolverr_url: value }))}
        placeholder="http://192.168.50.30:8191"
      />

      <PluginUrlInput
        label={websiteLabel}
        value={state.tracker_url}
        onChange={value => setState(prev => ({ ...prev, tracker_url: value }))}
        placeholder={websitePlaceholder}
      />

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('settings.plugins.ygg.username')}
        </label>
        <input
          type="text"
          value={state.username}
          onChange={event => setState(prev => ({ ...prev, username: event.target.value }))}
          placeholder={trackerLabel}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('settings.plugins.ygg.password')}
        </label>
        <input
          type="password"
          value={state.password}
          onChange={event => setState(prev => ({ ...prev, password: event.target.value }))}
          placeholder={t('settings.plugins.ygg.passwordPlaceholder')}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
        />
      </div>

      <div className="flex items-center gap-3">
        {isDirty && (
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium mr-auto">
            {t('settings.plugins.unsavedChanges')}
          </span>
        )}
        <div className="flex items-center gap-3 ml-auto">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isBusy}
            className="px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isBusy}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-primary-600 hover:bg-primary-700"
          >
            {saving ? t('common.loading') : t('settings.plugins.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TrackersPluginSection() {
  const { t } = useTranslation('common');
  const yggQuery = useYggPlugin();
  const yggMutation = useUpdateYggPlugin();
  const c411Query = useC411Plugin();
  const c411Mutation = useUpdateC411Plugin();
  const torr9Query = useTorr9Plugin();
  const torr9Mutation = useUpdateTorr9Plugin();
  const g3miniQuery = useG3miniPlugin();
  const g3miniMutation = useUpdateG3miniPlugin();

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Trackers</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
          Configure YGG, C411, Torr9, and G3mini in one place.
        </p>
      </div>

      <TrackerEditor
        title="YGG"
        logoUrl="/icons/ygg.svg"
        trackerLabel="username"
        websiteLabel={t('settings.plugins.ygg.yggUrl')}
        websitePlaceholder="https://www.yggtorrent.org"
        loading={yggQuery.isLoading}
        saving={yggMutation.isPending}
        initial={{
          enabled: Boolean(yggQuery.data?.plugin.enabled),
          flaresolverr_url: yggQuery.data?.plugin.flaresolverr_url || '',
          tracker_url: yggQuery.data?.plugin.ygg_url || '',
          username: yggQuery.data?.plugin.username || '',
        }}
        onSave={payload =>
          yggMutation.mutateAsync({
            enabled: payload.enabled,
            flaresolverr_url: payload.flaresolverr_url,
            ygg_url: payload.tracker_url,
            username: payload.username,
            password: payload.password,
          })
        }
      />

      <TrackerEditor
        title="C411"
        logoUrl="/icons/c411.png"
        trackerLabel="username"
        websiteLabel="Tracker URL"
        websitePlaceholder="https://www.cpasbien411.com"
        loading={c411Query.isLoading}
        saving={c411Mutation.isPending}
        initial={{
          enabled: Boolean(c411Query.data?.plugin.enabled),
          flaresolverr_url: c411Query.data?.plugin.flaresolverr_url || '',
          tracker_url: c411Query.data?.plugin.tracker_url || '',
          username: c411Query.data?.plugin.username || '',
        }}
        onSave={payload => c411Mutation.mutateAsync(payload)}
      />

      <TrackerEditor
        title="Torr9"
        logoUrl="/icons/torr9.png"
        trackerLabel="username"
        websiteLabel="Tracker URL"
        websitePlaceholder="https://www.torr9.com"
        loading={torr9Query.isLoading}
        saving={torr9Mutation.isPending}
        initial={{
          enabled: Boolean(torr9Query.data?.plugin.enabled),
          flaresolverr_url: torr9Query.data?.plugin.flaresolverr_url || '',
          tracker_url: torr9Query.data?.plugin.tracker_url || '',
          username: torr9Query.data?.plugin.username || '',
        }}
        onSave={payload => torr9Mutation.mutateAsync(payload)}
      />

      <TrackerEditor
        title="G3mini"
        logoUrl="/icons/g3mini.ico"
        trackerLabel="username"
        websiteLabel="Tracker URL"
        websitePlaceholder="https://www.g3mini.com"
        loading={g3miniQuery.isLoading}
        saving={g3miniMutation.isPending}
        initial={{
          enabled: Boolean(g3miniQuery.data?.plugin.enabled),
          flaresolverr_url: g3miniQuery.data?.plugin.flaresolverr_url || '',
          tracker_url: g3miniQuery.data?.plugin.tracker_url || '',
          username: g3miniQuery.data?.plugin.username || '',
        }}
        onSave={payload => g3miniMutation.mutateAsync(payload)}
      />
    </div>
  );
}
