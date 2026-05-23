import { useEffect, useRef } from "react";
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

  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [isOpen]);

  return (
    <RadixDialog.Root
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[var(--z-modal)] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:duration-150 data-[state=closed]:duration-100" />
        <div className="fixed inset-0 z-[var(--z-modal)] overflow-y-auto overscroll-contain">
          <div className="flex min-h-full items-center justify-center p-4">
            <RadixDialog.Content
              onOpenAutoFocus={(e) => e.preventDefault()}
              className="pointer-events-auto relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 text-left shadow-xl outline-none dark:border-neutral-700 dark:bg-neutral-900 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:duration-150 data-[state=closed]:duration-100"
            >
              <RadixDialog.Title className="sr-only">
                {t("medias.detail.addToLibrary")}
              </RadixDialog.Title>
              <RadixDialog.Description className="sr-only">
                {t("medias.detail.addToLibrary")}
              </RadixDialog.Description>
              <RadixDialog.Close
                aria-label="Close"
                className="absolute right-4 top-4 z-20 rounded-full p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700/60 dark:hover:text-neutral-200"
              >
                <X className="h-5 w-5" />
              </RadixDialog.Close>
              <TmdbMediaSearchPanel variant="modal" inputRef={inputRef} />
            </RadixDialog.Content>
          </div>
        </div>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
