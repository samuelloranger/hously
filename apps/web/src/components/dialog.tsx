import { Dialog as HeadlessDialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { Fragment, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  showCloseButton?: boolean;
  panelClassName?: string;
}

const PORTAL_ID = 'hously-dialog-root';

export function Dialog({ isOpen, onClose, title, children, showCloseButton = true, panelClassName }: DialogProps) {
  return createPortal(
    <Transition appear show={isOpen} as={Fragment}>
      <HeadlessDialog as="div" className="fixed inset-0 z-[var(--z-modal)]" onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto pointer-events-none">
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
              <DialogPanel
                className={cn(
                  'pointer-events-auto flex max-h-[90dvh] w-full max-w-2xl flex-col transform overflow-y-auto rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-left align-middle shadow-xl transition-all dark:border-neutral-700 dark:bg-neutral-800',
                  panelClassName
                )}
              >
                <div className={cn("py-4 flex shrink-0 items-start justify-between gap-4", panelClassName?.includes('p-0') ? 'px-6' : '')}>
                  <DialogTitle
                    as="h3"
                    className="text-lg font-medium leading-6 text-neutral-900 dark:text-white"
                  >
                    {title}
                  </DialogTitle>
                  {showCloseButton && (
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="Close dialog"
                      className="rounded-full p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/60 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>

                <div className="min-h-0 flex-1">{children}</div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </HeadlessDialog>
    </Transition>,
    document.body,
    PORTAL_ID
  );
}
