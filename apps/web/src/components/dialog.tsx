import { Dialog as HeadlessDialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { Fragment, ReactNode, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  showCloseButton?: boolean;
  hideTitle?: boolean;
  panelClassName?: string;
  /** Panel shell does not scroll; children should use a fixed top block + overflow-y-auto region */
  bodyScroll?: boolean;
}

const PORTAL_ID = 'hously-dialog-root';

export function Dialog({
  isOpen,
  onClose,
  title,
  children,
  showCloseButton = true,
  hideTitle = false,
  panelClassName,
  bodyScroll = false,
}: DialogProps) {
  /** Preserve window scroll when the dialog mounts — Headless UI scroll-lock + focus can jump the page */
  const scrollYRef = useRef(0);
  useLayoutEffect(() => {
    if (!isOpen) return;
    scrollYRef.current = window.scrollY;
    const id = requestAnimationFrame(() => {
      window.scrollTo({ top: scrollYRef.current, left: 0, behavior: 'instant' });
    });
    return () => cancelAnimationFrame(id);
  }, [isOpen]);

  return createPortal(
    <Transition appear show={isOpen} as={Fragment}>
      <HeadlessDialog
        open={isOpen}
        autoFocus={false}
        as="div"
        className="fixed inset-0 z-[var(--z-modal)]"
        onClose={() => onClose()}
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
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto overscroll-contain pointer-events-none">
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
                  'pointer-events-auto flex max-h-[90dvh] w-full max-w-2xl flex-col transform rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-left align-middle shadow-xl transition-all dark:border-neutral-700 dark:bg-neutral-800',
                  bodyScroll ? 'min-h-0 overflow-hidden' : 'overflow-y-auto',
                  hideTitle && 'relative',
                  panelClassName
                )}
              >
                <DialogTitle
                  as="h3"
                  className={cn(
                    hideTitle
                      ? 'sr-only'
                      : cn('pb-2 shrink-0 text-lg font-medium leading-6 text-neutral-900 dark:text-white', panelClassName?.includes('p-0') ? 'pt-4 px-6' : ''),
                  )}
                >
                  {title}
                </DialogTitle>

                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close dialog"
                    className={cn(
                      'pointer-events-auto absolute shrink-0 rounded-full p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/60 transition-colors',
                      /* z-20: above modal content (e.g. media hero z-10) that uses negative margin into this corner */
                      hideTitle ? 'top-4 right-4 z-20' : 'top-5 right-5 z-20'
                    )}
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}

                <div
                  className={cn(
                    'min-h-0 flex-1',
                    bodyScroll && 'flex min-h-0 flex-col overflow-hidden'
                  )}
                >
                  {children}
                </div>
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
