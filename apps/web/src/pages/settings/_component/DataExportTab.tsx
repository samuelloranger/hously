import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useExportData, useImportData } from '@/hooks/useAdmin';

export function DataExportTab() {
  const { t } = useTranslation('common');
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isPending: isExporting, mutateAsync: triggerExport } = useExportData();

  const { mutateAsync: triggerImport, isPending: isImporting } = useImportData();

  const handleExport = async () => {
    try {
      const exportData = await triggerExport();
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hously-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('settings.dataExport.exportSuccess'));
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('settings.dataExport.exportError'));
    }
  };

  const handleImportSubmit = useCallback(async () => {
    if (!importFile) return;
    try {
      const text = await importFile.text();
      const data = JSON.parse(text);
      const response = await triggerImport(data);
      if (response.success) {
        const counts = response.imported;
        const summary = t('settings.dataExport.importSummary', {
          chores: counts.chores,
          reminders: counts.reminders,
          shoppingItems: counts.shopping_items,
          taskCompletions: counts.task_completions,
        });

        if (response.warnings && response.warnings.length > 0) {
          const warningsMsg = t('settings.dataExport.importWarnings', {
            count: response.warnings.length,
          });
          console.warn('Import warnings:', response.warnings);
          toast.success(`${summary} ${warningsMsg}`);
        } else {
          toast.success(summary);
        }

        setImportFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        toast.error(t('settings.dataExport.importError'));
      }
    } catch (error) {
      console.error('File parse error:', error);
      toast.error((error instanceof Error ? error.message : null) || t('settings.dataExport.importError'));
    }
  }, [importFile, t, triggerImport]);

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300" key="data-export-tab">
      <div className="space-y-6">
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
          <h2 className="text-lg font-semibold mb-1.5 text-neutral-900 dark:text-neutral-100">
            {t('settings.dataExport.title')}
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">{t('settings.dataExport.description')}</p>

          <div className="space-y-4">
            {/* Export Section */}
            <div className="border-b border-neutral-200 dark:border-neutral-700 pb-4">
              <h3 className="text-lg font-medium mb-2 text-neutral-900 dark:text-neutral-100">
                {t('settings.dataExport.exportTitle')}
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                {t('settings.dataExport.exportDescription')}
              </p>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isExporting ? t('settings.dataExport.exporting') : t('settings.dataExport.exportButton')}
              </button>
            </div>

            {/* Import Section */}
            <div>
              <h3 className="text-lg font-medium mb-2 text-neutral-900 dark:text-neutral-100">
                {t('settings.dataExport.importTitle')}
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                {t('settings.dataExport.importDescription')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={event => setImportFile(event.currentTarget.files?.[0] ?? null)}
                  disabled={isImporting}
                  className="w-full text-sm text-neutral-700 dark:text-neutral-200 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 dark:file:bg-neutral-700/50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-neutral-800 dark:file:text-neutral-100"
                />
                <button
                  type="button"
                  onClick={() => void handleImportSubmit()}
                  disabled={isImporting || !importFile}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isImporting ? t('settings.dataExport.importing') : t('settings.dataExport.importButton')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
