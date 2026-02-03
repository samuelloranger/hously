import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

interface EmotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmotion: (emotion: string) => void;
  taskName: string;
}

const emotions = [
  {
    emoji: "🥵",
    label: "Overwhelmed",
    color: "bg-red-100 hover:bg-red-200 border-red-300",
  },
  {
    emoji: "😢",
    label: "Frustrated",
    color: "bg-blue-100 hover:bg-blue-200 border-blue-300",
  },
  {
    emoji: "😐",
    label: "Neutral",
    color: "bg-neutral-100 hover:bg-neutral-200 border-neutral-300",
  },
  {
    emoji: "😄",
    label: "Happy",
    color: "bg-yellow-100 hover:bg-yellow-200 border-yellow-300",
  },
  {
    emoji: "🔥",
    label: "Energized",
    color: "bg-orange-100 hover:bg-orange-200 border-orange-300",
  },
];

export function EmotionModal({
  isOpen,
  onClose,
  onSelectEmotion,
  taskName,
}: EmotionModalProps) {
  const { t } = useTranslation("common");
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectEmotion = (emotion: string) => {
    setSelectedEmotion(emotion);
    onSelectEmotion(emotion);
    onClose();
  };

  const handleSkip = () => {
    onSelectEmotion("");
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[var(--z-modal)] p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-md w-full max-h-[90dvh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <h3 className="text-lg font-medium text-neutral-900 dark:text-white">
            {t("emotion.howDidYouFeel")}
          </h3>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {t("emotion.afterCompleting")} "{taskName}"
          </p>
        </div>

        <div className="px-6 py-6">
          <div className="grid grid-cols-5 gap-3 mb-6">
            {emotions.map((emotion) => (
              <button
                key={emotion.emoji}
                onClick={() => handleSelectEmotion(emotion.emoji)}
                className={`aspect-square rounded-lg border-2 transition-all duration-200 flex flex-col items-center justify-center p-3 ${
                  emotion.color
                } ${
                  selectedEmotion === emotion.emoji
                    ? "ring-2 ring-blue-500 border-blue-500"
                    : "border-transparent"
                }`}
              >
                <span className="text-2xl mb-1">{emotion.emoji}</span>
                <span className="text-xs font-medium text-center text-neutral-900 leading-tight">
                  {t(`emotion.${emotion.label.toLowerCase()}`)}
                </span>
              </button>
            ))}
          </div>

          <div className="flex justify-between">
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
            >
              {t("emotion.skip")}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-900 dark:text-white bg-neutral-200 dark:bg-neutral-600 rounded-md hover:bg-neutral-300 dark:hover:bg-neutral-500 transition-colors"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
