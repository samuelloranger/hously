import { useTranslation } from "react-i18next";
import { ChevronUp, ChevronDown } from "lucide-react";

interface WidgetEditWrapperProps {
  children: React.ReactNode;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export function WidgetEditWrapper({
  children,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: WidgetEditWrapperProps) {
  const { t } = useTranslation("common");
  return (
    <div className="relative">
      {children}
      <div className="absolute top-2 right-2 flex flex-col gap-0.5 z-10">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          className="flex items-center justify-center w-6 h-6 rounded bg-neutral-800/90 border border-neutral-700 shadow-sm transition-opacity disabled:opacity-30"
          aria-label={t("dashboard.moveWidgetUp")}
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          className="flex items-center justify-center w-6 h-6 rounded bg-neutral-800/90 border border-neutral-700 shadow-sm transition-opacity disabled:opacity-30"
          aria-label={t("dashboard.moveWidgetDown")}
        >
          <ChevronDown size={14} />
        </button>
      </div>
    </div>
  );
}
