import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import type { NotificationTemplate } from "@hously/shared";
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
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[100]" onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full max-w-2xl max-h-[90dvh] transform overflow-y-auto rounded-2xl bg-neutral-50 dark:bg-neutral-800 p-6 text-left align-middle shadow-xl transition-all border border-neutral-200 dark:border-neutral-700">
                <DialogTitle
                  as="h3"
                  className="text-lg font-medium leading-6 text-neutral-900 dark:text-white mb-4"
                >
                  {t("settings.externalNotifications.editTemplate")}
                </DialogTitle>

                <TemplateEditor
                  templates={templates}
                  eventType={eventType}
                  onCancel={onClose}
                />
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
