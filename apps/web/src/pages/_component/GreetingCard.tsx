import { useMemo } from "react";
import { useTranslation } from "react-i18next";

interface GreetingCardProps {
  userName: string;
  pendingChores: number | undefined;
  eventsToday: number | undefined;
}

type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

export function GreetingCard({
  userName,
  pendingChores,
  eventsToday,
}: GreetingCardProps) {
  const { t } = useTranslation("common");

  const { greeting, subtext } = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    const timeOfDay = getTimeOfDay(hour);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    let baseGreeting: string;
    switch (timeOfDay) {
      case "morning":
        baseGreeting = t("dashboard.goodMorning");
        break;
      case "afternoon":
        baseGreeting = t("dashboard.goodAfternoon");
        break;
      default:
        baseGreeting = t("dashboard.goodEvening");
        break;
    }

    // Time-based subtext — stable between SSR and initial client render.
    // Used as-is when stats aren't loaded yet, and as fallback for
    // weekdays with 1–5 pending chores (no data-specific message needed).
    let subtext: string;
    switch (timeOfDay) {
      case "morning":
        subtext = t("dashboard.subtexts.morning", {
          defaultValue: "Ready to make today count?",
        });
        break;
      case "afternoon":
        subtext = t("dashboard.subtexts.afternoon", {
          defaultValue: "Keep the momentum going!",
        });
        break;
      case "evening":
        subtext = t("dashboard.subtexts.evening", {
          defaultValue: "Wrapping up the day? Check your progress.",
        });
        break;
      default:
        subtext = t("dashboard.subtexts.night", {
          defaultValue: "Planning for tomorrow?",
        });
        break;
    }

    // Override with data-aware subtext once stats are loaded.
    if (pendingChores !== undefined && eventsToday !== undefined) {
      if (eventsToday > 2) {
        subtext = t("dashboard.subtexts.busyDay", {
          count: eventsToday,
          defaultValue: `You have ${eventsToday} events today. Stay organized!`,
        });
      } else if (isWeekend) {
        if (pendingChores > 3) {
          subtext = t("dashboard.subtexts.weekendChores", {
            count: pendingChores,
            defaultValue: `${pendingChores} chores await. Perfect day to knock them out!`,
          });
        } else if (pendingChores === 0) {
          subtext = t("dashboard.subtexts.weekendFree", {
            defaultValue: "All caught up! Enjoy your weekend.",
          });
        } else {
          subtext = t("dashboard.subtexts.weekendRelax", {
            defaultValue: "Time to relax and recharge.",
          });
        }
      } else if (dayOfWeek === 1) {
        subtext = t("dashboard.subtexts.monday", {
          defaultValue: "Fresh week, fresh start. You got this!",
        });
      } else if (dayOfWeek === 5) {
        subtext = t("dashboard.subtexts.friday", {
          defaultValue: "Almost there! Finish strong.",
        });
      } else if (pendingChores === 0) {
        subtext = t("dashboard.subtexts.allClear", {
          defaultValue: "Everything's in order. Nice work!",
        });
      } else if (pendingChores > 5) {
        subtext = t("dashboard.subtexts.manyChores", {
          count: pendingChores,
          defaultValue: `${pendingChores} tasks waiting. One step at a time!`,
        });
      }
      // 1–5 pending chores on a normal weekday: time-based subtext stays
    }

    return { greeting: baseGreeting, subtext };
  }, [pendingChores, eventsToday, t]);

  return (
    <div>
      <h1 className="text-lg md:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        {greeting}, {userName}
      </h1>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
        {subtext}
      </p>
    </div>
  );
}
