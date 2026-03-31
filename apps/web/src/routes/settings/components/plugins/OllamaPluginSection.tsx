import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOllamaPlugin, useUpdateOllamaPlugin } from '@hously/shared';
import { toast } from 'sonner';
import { PluginSectionCard } from './PluginSectionCard';

export function OllamaPluginSection() {
  const { data, isLoading } = useOllamaPlugin();
  return <OllamaPluginSectionImpl key={data?.plugin?.type ?? 'pending'} data={data} isLoading={isLoading} />;
}

function OllamaPluginSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useOllamaPlugin>['data'];
  isLoading: boolean;
}) {
  const { t } = useTranslation('common');
  const saveMutation = useUpdateOllamaPlugin();

  const [baseUrl, setBaseUrl] = useState(data?.plugin?.base_url || '');
  const [model, setModel] = useState(data?.plugin?.model || 'llama3.2');
  const [enabled, setEnabled] = useState(Boolean(data?.plugin?.enabled));

  const isDirty = useMemo(() => {
    if (!data?.plugin) return false;
    return (
      baseUrl !== (data.plugin.base_url || '') ||
      model !== (data.plugin.model || 'llama3.2') ||
      enabled !== Boolean(data.plugin.enabled)
    );
  }, [data, baseUrl, model, enabled]);

  const handleCancel = () => {
    setBaseUrl(data?.plugin.base_url || '');
    setModel(data?.plugin.model || 'llama3.2');
    setEnabled(Boolean(data?.plugin.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({ base_url: baseUrl, model, enabled })
      .then(() => toast.success(t('settings.plugins.saveSuccess')))
      .catch(() => toast.error(t('settings.plugins.saveError')));
  };

  return (
    <PluginSectionCard
      title={t('settings.plugins.ollama.title')}
      description={t('settings.plugins.ollama.help')}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
    >
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('settings.plugins.ollama.baseUrl')}
        </label>
        <input
          type="url"
          value={baseUrl}
          onChange={event => setBaseUrl(event.target.value)}
          placeholder={t('settings.plugins.ollama.baseUrlPlaceholder')}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('settings.plugins.ollama.model')}
        </label>
        <input
          type="text"
          value={model}
          onChange={event => setModel(event.target.value)}
          placeholder={t('settings.plugins.ollama.modelPlaceholder')}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono text-sm"
        />
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{t('settings.plugins.ollama.modelHelp')}</p>
      </div>
    </PluginSectionCard>
  );
}
