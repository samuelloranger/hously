import { useEffect, useState, startTransition } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  alt?: string;
}

export function ImageModal({ isOpen, onClose, imageUrl, alt }: ImageModalProps) {
  const { t } = useTranslation('common');
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      startTransition(() => {
        setShouldRender(true);
        setIsClosing(false);
      });
      document.body.style.overflow = 'hidden';
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen && shouldRender) {
      startTransition(() => setIsClosing(true));
      document.body.style.overflow = '';
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 300);
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, shouldRender]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!shouldRender) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black bg-opacity-75 dark:bg-opacity-90 ${
        isClosing ? 'image-modal-backdrop-closing' : 'image-modal-backdrop'
      }`}
      onClick={onClose}
    >
      <div
        className={`relative max-w-[90vw] max-h-[90vh] flex items-center justify-center ${
          isClosing ? 'image-modal-content-closing' : 'image-modal-content'
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 text-white bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full transition-colors"
          aria-label={t('common.close') || 'Close'}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <img
          src={imageUrl}
          alt={alt || ''}
          className={`max-w-full max-h-[90vh] object-contain ${
            isClosing ? 'image-modal-image-closing' : 'image-modal-image'
          }`}
          onClick={e => e.stopPropagation()}
        />
      </div>
    </div>,
    document.body
  );
}
