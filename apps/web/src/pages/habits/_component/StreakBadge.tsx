import React from "react";
import { useTranslation } from "react-i18next";

interface StreakBadgeProps {
  streak: number;
}

export const StreakBadge: React.FC<StreakBadgeProps> = ({ streak }) => {
  const { t } = useTranslation("common");

  if (streak <= 1) return null;

  return (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[11px] font-bold tracking-tight border border-amber-200/50 dark:border-amber-700/30">
      <span role="img" aria-label="streak">
        🔥
      </span>
      <span>{t("habits.streak", { count: streak })}</span>
    </div>
  );
};
