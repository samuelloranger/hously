import { useMemo } from "react";
import { useTranslation } from "react-i18next";

interface GreetingCardProps {
  userName: string;
  pendingChores: number;
  shoppingItems: number;
  eventsToday: number;
}

type GreetingContext = {
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
  dayOfWeek: number;
  isWeekend: boolean;
  pendingChores: number;
  shoppingItems: number;
  eventsToday: number;
};

function getTimeOfDay(hour: number): GreetingContext["timeOfDay"] {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

export function GreetingCard({
  userName,
  pendingChores,
  shoppingItems,
  eventsToday,
}: GreetingCardProps) {
  const { t } = useTranslation("common");

  const { greeting, subtext } = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    const context: GreetingContext = {
      timeOfDay: getTimeOfDay(hour),
      dayOfWeek,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      pendingChores,
      shoppingItems,
      eventsToday,
    };

    let baseGreeting: string;
    switch (context.timeOfDay) {
      case "morning":
        baseGreeting = t("dashboard.goodMorning");
        break;
      case "afternoon":
        baseGreeting = t("dashboard.goodAfternoon");
        break;
      case "evening":
      case "night":
        baseGreeting = t("dashboard.goodEvening");
        break;
      default:
        baseGreeting = t("dashboard.goodEvening");
        break;
    }

    let subtext: string;

    if (eventsToday > 2) {
      subtext = t("dashboard.subtexts.busyDay", {
        count: eventsToday,
        defaultValue: `You have ${eventsToday} events today. Stay organized!`,
      });
    } else if (context.isWeekend) {
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
    } else if (context.dayOfWeek === 1) {
      subtext = t("dashboard.subtexts.monday", {
        defaultValue: "Fresh week, fresh start. You got this!",
      });
    } else if (context.dayOfWeek === 5) {
      subtext = t("dashboard.subtexts.friday", {
        defaultValue: "Almost there! Finish strong.",
      });
    } else if (pendingChores === 0 && shoppingItems === 0) {
      subtext = t("dashboard.subtexts.allClear", {
        defaultValue: "Everything's in order. Nice work!",
      });
    } else if (pendingChores > 5) {
      subtext = t("dashboard.subtexts.manyChores", {
        count: pendingChores,
        defaultValue: `${pendingChores} tasks waiting. One step at a time!`,
      });
    } else if (shoppingItems > 5) {
      subtext = t("dashboard.subtexts.shoppingNeeded", {
        defaultValue: "Shopping list is growing. Time to plan a trip?",
      });
    } else {
      switch (context.timeOfDay) {
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
        case "night":
          subtext = t("dashboard.subtexts.night", {
            defaultValue: "Planning for tomorrow?",
          });
          break;
      }
    }

    return { greeting: baseGreeting, subtext };
  }, [pendingChores, shoppingItems, eventsToday, t]);

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
