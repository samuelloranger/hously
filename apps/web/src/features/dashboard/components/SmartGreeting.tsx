import { useMemo } from "react";
import { useTranslation } from "react-i18next";

interface SmartGreetingProps {
  userName: string;
  pendingChores: number;
  shoppingItems: number;
  eventsToday: number;
}

type GreetingContext = {
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
  dayOfWeek: number; // 0 = Sunday
  isWeekend: boolean;
  season: "spring" | "summer" | "fall" | "winter";
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

function getSeason(month: number): GreetingContext["season"] {
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "fall";
  return "winter";
}

function getGreetingIcon(context: GreetingContext): string {
  const { timeOfDay, season, isWeekend, eventsToday, pendingChores } = context;

  // Priority: Events today
  if (eventsToday > 2) return "📅";

  // Busy day with chores
  if (pendingChores > 5) return "💪";

  // Weekend vibes
  if (isWeekend) {
    if (timeOfDay === "morning") return "☕";
    return "🌟";
  }

  // Time-based with seasonal touches
  if (timeOfDay === "morning") {
    if (season === "winter") return "❄️";
    if (season === "summer") return "☀️";
    if (season === "spring") return "🌸";
    return "🍂";
  }

  if (timeOfDay === "afternoon") {
    if (season === "summer") return "🌞";
    return "✨";
  }

  if (timeOfDay === "evening") {
    if (season === "winter") return "🌙";
    return "🌅";
  }

  // Night
  return "🌙";
}

export function SmartGreeting({
  userName,
  pendingChores,
  shoppingItems,
  eventsToday,
}: SmartGreetingProps) {
  const { t } = useTranslation("common");

  const { greeting, subtext, icon } = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    const month = now.getMonth();

    const context: GreetingContext = {
      timeOfDay: getTimeOfDay(hour),
      dayOfWeek,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      season: getSeason(month),
      pendingChores,
      shoppingItems,
      eventsToday,
    };

    const icon = getGreetingIcon(context);

    // Build the greeting based on time of day
    let baseGreeting: string;
    switch (context.timeOfDay) {
      case "morning":
        baseGreeting = t("dashboard.goodMorning");
        break;
      case "afternoon":
        baseGreeting = t("dashboard.goodAfternoon");
        break;
      case "evening":
        baseGreeting = t("dashboard.goodEvening");
        break;
      case "night":
        baseGreeting = t("dashboard.goodEvening"); // Use evening for late night too
        break;
    }

    // Build contextual subtext
    let subtext: string;

    // High priority: Busy day
    if (eventsToday > 2) {
      subtext = t("dashboard.subtexts.busyDay", {
        count: eventsToday,
        defaultValue: `You have ${eventsToday} events today. Stay organized!`,
      });
    }
    // Weekend messages
    else if (context.isWeekend) {
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
    }
    // Monday motivation
    else if (context.dayOfWeek === 1) {
      subtext = t("dashboard.subtexts.monday", {
        defaultValue: "Fresh week, fresh start. You got this!",
      });
    }
    // Friday celebration
    else if (context.dayOfWeek === 5) {
      subtext = t("dashboard.subtexts.friday", {
        defaultValue: "Almost there! Finish strong.",
      });
    }
    // Task-based messages
    else if (pendingChores === 0 && shoppingItems === 0) {
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
    }
    // Time-based defaults
    else {
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

    return { greeting: baseGreeting, subtext, icon };
  }, [pendingChores, shoppingItems, eventsToday, t]);

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2">
        <span className="text-3xl greeting-icon">{icon}</span>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
          {greeting}, {userName}!
        </h1>
      </div>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
        <span className="inline-block greeting-subtext">{subtext}</span>
      </p>
    </div>
  );
}
