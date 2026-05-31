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
    color: "bg-red-500/15 hover:bg-red-500/25 border-red-500/30",
  },
  {
    emoji: "😢",
    label: "Frustrated",
    color: "bg-blue-500/15 hover:bg-blue-500/25 border-blue-500/30",
  },
  {
    emoji: "😐",
    label: "Neutral",
    color: "bg-neutral-500/15 hover:bg-neutral-500/25 border-neutral-500/30",
  },
  {
    emoji: "😄",
    label: "Happy",
    color: "bg-yellow-500/15 hover:bg-yellow-500/25 border-yellow-500/30",
  },
  {
    emoji: "🔥",
    label: "Energized",
    color: "bg-orange-500/15 hover:bg-orange-500/25 border-orange-500/30",
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
      <div className="bg-neutral-800 rounded-lg shadow-xl max-w-md w-full max-h-[90dvh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-neutral-700">
          <h3 className="text-lg font-medium text-white">
            {t("emotion.howDidYouFeel")}
          </h3>
          <p className="mt-1 text-sm text-neutral-400">
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
                <span className="text-xs font-medium text-center text-neutral-100 leading-tight">
                  {t(`emotion.${emotion.label.toLowerCase()}`)}
                </span>
              </button>
            ))}
          </div>

          <div className="flex justify-between">
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 rounded-md hover:bg-neutral-600 transition-colors"
            >
              {t("emotion.skip")}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-neutral-600 rounded-md hover:bg-neutral-500 transition-colors"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
