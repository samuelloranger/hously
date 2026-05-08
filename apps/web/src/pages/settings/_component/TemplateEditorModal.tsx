import { useTranslation } from "react-i18next";
import { Dialog } from "@/components/dialog";
import type { NotificationTemplate } from "@hously/shared/types";
import { TemplateEditor } from "@/pages/settings/_component/TemplateEditor";

interface TemplateEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: NotificationTemplate[];
  eventType: string;
}

export function TemplateEditorModal({
  isOpen,
  onClose,
  templates,
  eventType,
}: TemplateEditorModalProps) {
  const { t } = useTranslation("common");

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("settings.externalNotifications.editTemplate")}
    >
      <TemplateEditor
        templates={templates}
        eventType={eventType}
        onCancel={onClose}
      />
    </Dialog>
  );
}
