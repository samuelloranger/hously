import { useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { EditChoreForm } from "@/pages/chores/_component/EditChoreForm";
import { ImageModal } from "@/components/ImageModal";
import { getChoreImageUrl, type Chore, type ChoreUser } from "@hously/shared";
import { X } from "lucide-react";

interface EditChoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  chore: Chore;
  users: ChoreUser[];
}

export function EditChoreModal({
  isOpen,
  onClose,
  chore,
  users,
}: EditChoreModalProps) {
  const { t } = useTranslation("common");
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-[var(--z-modal)]"
        onClose={onClose}
      >
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
              <DialogPanel className="w-full max-w-2xl max-h-[80dvh] transform overflow-y-auto rounded-2xl bg-neutral-50 dark:bg-neutral-800 p-6 text-left align-middle shadow-xl transition-all border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-between mb-4">
                  <DialogTitle
                    as="h3"
                    className="text-lg font-medium leading-6 text-neutral-900 dark:text-white mb-4"
                  >
                    {t("chores.editChore")}
                  </DialogTitle>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    <X className="h-5 w-5" />
                    <span className="sr-only">{t("common.close")}</span>
                  </button>
                </div>

                <EditChoreForm
                  chore={chore}
                  users={users}
                  onClose={onClose}
                  onImageClick={() => setIsImageModalOpen(true)}
                />
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
      {chore.image_path && (
        <ImageModal
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
          imageUrl={getChoreImageUrl(chore.image_path) || ""}
          alt={chore.chore_name}
        />
      )}
    </Transition>
  );
}
