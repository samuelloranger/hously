import { type ReactNode, useState, useEffect, useRef, startTransition } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Check } from 'lucide-react';

interface PluginSectionCardProps {
  children: ReactNode;
  className?: string;
  description: string;
  enabled: boolean;
  isDirty?: boolean;
  loading: boolean;
  logoUrl?: string;
  onCancel: () => void;
  onEnabledChange: (enabled: boolean) => void;
  onSave: () => void;
  saving: boolean;
  title: string;
}

export function PluginSectionCard({
  children,
  className,
  description,
  enabled,
  isDirty,
  loading,
  logoUrl,
  onCancel,
  onEnabledChange,
  onSave,
  saving,
  title,
}: PluginSectionCardProps) {
  const { t } = useTranslation('common');
  const isBusy = loading || saving;
  const [isOpen, setIsOpen] = useState(enabled);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const prevSaving = useRef(false);

  // Auto-expand when plugin gets enabled
  useEffect(() => {
    if (enabled) startTransition(() => setIsOpen(true));
  }, [enabled]);

  // Detect save completion and briefly show success state
  useEffect(() => {
    const wasSaving = prevSaving.current;
    prevSaving.current = saving;
    if (wasSaving && !saving) {
      startTransition(() => setSaveSuccess(true));
      const timer = setTimeout(() => setSaveSuccess(false), 1500);
      return () => clearTimeout(timer);
    }
    return () => {};
  }, [saving]);

  return (
    <div
      className={cn(
        'bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700',
        className
      )}
    >
      {/* Header — always visible */}
      <div className="flex items-center gap-3 p-5">
        <button
          type="button"
          onClick={() => setIsOpen(o => !o)}
          className="flex items-center gap-3 flex-1 text-left min-w-0 overflow-hidden"
        >
          {logoUrl && (
            <img
              src={logoUrl}
              alt={title}
              className="w-10 h-10 rounded-xl object-contain flex-shrink-0"
              onError={e => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
              {isDirty && (
                <span
                  className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"
                  title={t('settings.plugins.unsavedChanges')}
                />
              )}
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">{description}</p>
          </div>
        </button>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Toggle switch */}
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => onEnabledChange(!enabled)}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-800 appearance-none',
              enabled ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700'
            )}
          >
            <span
              className={cn(
                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                enabled ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </button>

          {/* Chevron */}
          <button
            type="button"
            onClick={() => setIsOpen(o => !o)}
            className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-md transition-colors"
          >
            <ChevronDown className={cn('w-4 h-4 transition-transform duration-200', isOpen && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Expandable content */}
      {isOpen && (
        <div className="border-t border-neutral-200 dark:border-neutral-700 p-5 pt-4">
          <div className="space-y-4">{children}</div>

          <div className="mt-6 flex items-center gap-3">
            {isDirty && (
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium mr-auto">
                {t('settings.plugins.unsavedChanges')}
              </span>
            )}
            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={onCancel}
                disabled={isBusy}
                className="px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={isBusy}
                className={cn(
                  'px-4 py-2 rounded-lg text-white text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2',
                  saveSuccess ? 'bg-green-600' : 'bg-primary-600 hover:bg-primary-700'
                )}
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    {t('common.saved')}
                  </>
                ) : saving ? (
                  t('common.loading')
                ) : (
                  t('settings.plugins.save')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
