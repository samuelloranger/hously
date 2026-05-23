import { useRef } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TmdbMediaSearchPanel } from "@/pages/medias/_component/TmdbMediaSearchPanel";

interface AddToLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddToLibraryModal({ isOpen, onClose }: AddToLibraryModalProps) {
  const { t } = useTranslation("common");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <RadixDialog.Root
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[var(--z-modal)] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:duration-150 data-[state=closed]:duration-100" />
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-0 sm:p-6">
          <RadixDialog.Content
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              inputRef.current?.focus();
            }}
            className="flex h-full w-full flex-col overflow-y-auto bg-white outline-none dark:bg-neutral-900 sm:h-[95dvh] sm:max-w-4xl sm:rounded-2xl sm:border sm:border-neutral-200 sm:shadow-xl sm:dark:border-neutral-700 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:duration-150 data-[state=closed]:duration-100"
          >
            <RadixDialog.Title className="sr-only">
              {t("medias.detail.addToLibrary")}
            </RadixDialog.Title>
            <RadixDialog.Description className="sr-only">
              {t("medias.detail.addToLibrary")}
            </RadixDialog.Description>
            <div className="flex shrink-0 justify-end p-4">
              <RadixDialog.Close
                aria-label="Close"
                className="rounded-full p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700/60 dark:hover:text-neutral-200"
              >
                <X className="h-5 w-5" />
              </RadixDialog.Close>
            </div>
            <div className="flex-1 px-4 pb-8 sm:px-6">
              <TmdbMediaSearchPanel variant="default" inputRef={inputRef} />
            </div>
          </RadixDialog.Content>
        </div>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
