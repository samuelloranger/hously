import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useExportData, useImportData } from '@hously/shared';

export function DataExportTab() {
  const { t } = useTranslation('common');
  const [shouldExport, setShouldExport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: exportData, isPending: isExporting, mutateAsync: triggerExport } = useExportData();

  const { mutateAsync: triggerImport, isPending: isImporting } = useImportData();

  // Handle export data download when available
  useEffect(() => {
    if (exportData && shouldExport) {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hously-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('settings.dataExport.exportSuccess'));
      setShouldExport(false);
    }
  }, [exportData, shouldExport, t]);

  const handleExport = async () => {
    setShouldExport(true);
    try {
      await triggerExport();
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('settings.dataExport.exportError'));
    }
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
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
      } else {
        toast.error(t('settings.dataExport.importError'));
      }
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('File parse error:', error);
      toast.error(t('settings.dataExport.importError'));
      toast.error((error as any)?.message || t('settings.dataExport.importError'));
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300" key="data-export-tab">
      <div className="space-y-6">
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-2 text-neutral-900 dark:text-neutral-100">
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
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                disabled={isImporting}
                className="hidden"
                id="import-file-input"
              />
              <label
                htmlFor="import-file-input"
                className={`inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer ${
                  isImporting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isImporting ? t('settings.dataExport.importing') : t('settings.dataExport.importButton')}
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
