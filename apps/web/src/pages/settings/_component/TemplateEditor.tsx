import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateExternalNotificationTemplate } from "@/hooks/useExternalNotifications";
import { queryKeys } from "@/lib/queryKeys";
import { type NotificationTemplate } from "@hously/shared";

interface TemplateEditorProps {
  templates: NotificationTemplate[];
  eventType: string;
  onCancel?: () => void;
}

export function TemplateEditor({
  templates,
  eventType,
  onCancel,
}: TemplateEditorProps) {
  const { t, i18n } = useTranslation("common");
  const queryClient = useQueryClient();
  const updateTemplate = useUpdateExternalNotificationTemplate();
  const currentLanguage = i18n.language.split("-")[0] || "en";

  // Find template for current language or fallback to first available
  const getCurrentTemplate = useCallback(
    (lang: string): NotificationTemplate | null => {
      return (
        templates.find((t) => t.language === lang) ||
        templates.find((t) => t.language === "en") ||
        templates[0] ||
        null
      );
    },
    [templates],
  );

  const [selectedLanguage, setSelectedLanguage] =
    useState<string>(currentLanguage);
  const [currentTemplate, setCurrentTemplate] =
    useState<NotificationTemplate | null>(() =>
      getCurrentTemplate(currentLanguage),
    );
  const [titleTemplate, setTitleTemplate] = useState(
    currentTemplate?.title_template || "",
  );
  const [bodyTemplate, setBodyTemplate] = useState(
    currentTemplate?.body_template || "",
  );
  const [isSaving, setIsSaving] = useState(false);

  // Update template when language changes
  useEffect(() => {
    const template = getCurrentTemplate(selectedLanguage);
    if (template) {
      setCurrentTemplate(template);
      setTitleTemplate(template.title_template);
      setBodyTemplate(template.body_template);
    }
  }, [selectedLanguage, getCurrentTemplate]);

  // Update form when template changes
  useEffect(() => {
    if (currentTemplate) {
      setTitleTemplate(currentTemplate.title_template);
      setBodyTemplate(currentTemplate.body_template);
    }
  }, [currentTemplate]);

  const handleSave = async () => {
    if (!currentTemplate) return;

    setIsSaving(true);
    try {
      await updateTemplate.mutateAsync({
        templateId: currentTemplate.id,
        data: {
          title_template: titleTemplate,
          body_template: bodyTemplate,
        },
      });
      toast.success(t("settings.externalNotifications.templateSaved"));
      queryClient.invalidateQueries({
        queryKey: queryKeys.externalNotifications.services(),
      });
      if (onCancel) {
        onCancel();
      }
    } catch (error: any) {
      toast.error(error?.message || t("settings.externalNotifications.error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
  };

  // Get available variables from the first template (all templates for same event type have same variables)
  const availableVariables = templates[0]?.variables || {};

  if (!currentTemplate) {
    return (
      <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
        {t("settings.externalNotifications.noTemplates")}
      </div>
    );
  }

  const renderPreview = (template: string) => {
    let preview = template;
    Object.entries(availableVariables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "gi");
      preview = preview.replace(regex, value);
    });
    return preview;
  };

  // Get available languages from templates
  const availableLanguages = templates
    .map((t) => t.language)
    .filter((lang, index, self) => self.indexOf(lang) === index);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t("settings.externalNotifications.eventType")}: {eventType}
        </label>
        <div className="mb-4">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t("settings.externalNotifications.language")}
          </label>
          <select
            value={selectedLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            {availableLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {lang === "en"
                  ? "English"
                  : lang === "fr"
                    ? "Français"
                    : lang.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t("settings.externalNotifications.titleTemplate")}
        </label>
        <textarea
          value={titleTemplate}
          onChange={(e) => setTitleTemplate(e.target.value)}
          rows={2}
          className="w-full px-4 py-2 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
          placeholder="e.g., Movie grabbed: {{movie_name}}"
        />
        <div className="mt-2 p-2 bg-neutral-50 dark:bg-neutral-800 rounded text-sm text-neutral-600 dark:text-neutral-400">
          <strong>{t("settings.externalNotifications.preview")}:</strong>{" "}
          {renderPreview(titleTemplate)}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t("settings.externalNotifications.bodyTemplate")}
        </label>
        <textarea
          value={bodyTemplate}
          onChange={(e) => setBodyTemplate(e.target.value)}
          rows={4}
          className="w-full px-4 py-2 bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
          placeholder="e.g., Movie {{movie_name}} ({{year}}) has been grabbed"
        />
        <div className="mt-2 p-2 bg-neutral-50 dark:bg-neutral-800 rounded text-sm text-neutral-600 dark:text-neutral-400">
          <strong>{t("settings.externalNotifications.preview")}:</strong>{" "}
          {renderPreview(bodyTemplate)}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          {isSaving ? t("common.loading") : t("common.save")}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-500 transition-colors text-sm font-medium"
          >
            {t("common.cancel")}
          </button>
        )}
      </div>

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-800 dark:text-blue-200">
        <strong>
          {t("settings.externalNotifications.availableVariables")}:
        </strong>
        <div className="mt-1 font-mono">
          {Object.keys(availableVariables).map((key) => (
            <span key={key} className="mr-2">
              {`{{${key}}}`}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
