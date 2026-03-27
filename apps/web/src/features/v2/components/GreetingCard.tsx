import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays,
  Coffee,
  Flower2,
  Leaf,
  ListTodo,
  Moon,
  Snowflake,
  Sparkles,
  Sun,
  Sunrise,
} from 'lucide-react';

interface GreetingCardProps {
  userName: string;
  pendingChores: number;
  shoppingItems: number;
  eventsToday: number;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{children}</h3>;
}

type GreetingContext = {
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: number;
  isWeekend: boolean;
  season: 'spring' | 'summer' | 'fall' | 'winter';
  pendingChores: number;
  shoppingItems: number;
  eventsToday: number;
};

function getTimeOfDay(hour: number): GreetingContext['timeOfDay'] {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function getSeason(month: number): GreetingContext['season'] {
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

function greetingStatusIcon(context: GreetingContext): LucideIcon {
  const { timeOfDay, season, isWeekend, eventsToday, pendingChores } = context;

  if (eventsToday > 2) return CalendarDays;
  if (pendingChores > 5) return ListTodo;

  if (isWeekend) {
    return timeOfDay === 'morning' ? Coffee : Sparkles;
  }

  if (timeOfDay === 'morning') {
    if (season === 'winter') return Snowflake;
    if (season === 'summer') return Sun;
    if (season === 'spring') return Flower2;
    return Leaf;
  }

  if (timeOfDay === 'afternoon') {
    return season === 'summer' ? Sun : Sparkles;
  }

  if (timeOfDay === 'evening') {
    return season === 'winter' ? Moon : Sunrise;
  }

  return Moon;
}

export function GreetingCard({ userName, pendingChores, shoppingItems, eventsToday }: GreetingCardProps) {
  const { t } = useTranslation('common');

  const { greeting, subtext, Icon } = useMemo(() => {
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

    const Icon = greetingStatusIcon(context);

    let baseGreeting: string;
    switch (context.timeOfDay) {
      case 'morning':
        baseGreeting = t('dashboard.goodMorning');
        break;
      case 'afternoon':
        baseGreeting = t('dashboard.goodAfternoon');
        break;
      case 'evening':
      case 'night':
        baseGreeting = t('dashboard.goodEvening');
        break;
      default:
        baseGreeting = t('dashboard.goodEvening');
        break;
    }

    let subtext: string;

    if (eventsToday > 2) {
      subtext = t('dashboard.subtexts.busyDay', {
        count: eventsToday,
        defaultValue: `You have ${eventsToday} events today. Stay organized!`,
      });
    } else if (context.isWeekend) {
      if (pendingChores > 3) {
        subtext = t('dashboard.subtexts.weekendChores', {
          count: pendingChores,
          defaultValue: `${pendingChores} chores await. Perfect day to knock them out!`,
        });
      } else if (pendingChores === 0) {
        subtext = t('dashboard.subtexts.weekendFree', {
          defaultValue: 'All caught up! Enjoy your weekend.',
        });
      } else {
        subtext = t('dashboard.subtexts.weekendRelax', {
          defaultValue: 'Time to relax and recharge.',
        });
      }
    } else if (context.dayOfWeek === 1) {
      subtext = t('dashboard.subtexts.monday', {
        defaultValue: 'Fresh week, fresh start. You got this!',
      });
    } else if (context.dayOfWeek === 5) {
      subtext = t('dashboard.subtexts.friday', {
        defaultValue: 'Almost there! Finish strong.',
      });
    } else if (pendingChores === 0 && shoppingItems === 0) {
      subtext = t('dashboard.subtexts.allClear', {
        defaultValue: "Everything's in order. Nice work!",
      });
    } else if (pendingChores > 5) {
      subtext = t('dashboard.subtexts.manyChores', {
        count: pendingChores,
        defaultValue: `${pendingChores} tasks waiting. One step at a time!`,
      });
    } else if (shoppingItems > 5) {
      subtext = t('dashboard.subtexts.shoppingNeeded', {
        defaultValue: 'Shopping list is growing. Time to plan a trip?',
      });
    } else {
      switch (context.timeOfDay) {
        case 'morning':
          subtext = t('dashboard.subtexts.morning', {
            defaultValue: 'Ready to make today count?',
          });
          break;
        case 'afternoon':
          subtext = t('dashboard.subtexts.afternoon', {
            defaultValue: 'Keep the momentum going!',
          });
          break;
        case 'evening':
          subtext = t('dashboard.subtexts.evening', {
            defaultValue: 'Wrapping up the day? Check your progress.',
          });
          break;
        case 'night':
          subtext = t('dashboard.subtexts.night', {
            defaultValue: 'Planning for tomorrow?',
          });
          break;
      }
    }

    return { greeting: baseGreeting, subtext, Icon };
  }, [pendingChores, shoppingItems, eventsToday, t]);

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <span className="w-1 h-4 rounded-full bg-indigo-500 shrink-0" />
        <SectionTitle>{t('nav.dashboard')}</SectionTitle>
      </div>
      <div className="px-4 py-4 flex items-start gap-3">
        <Icon
          className="size-9 shrink-0 text-indigo-500 dark:text-indigo-400"
          strokeWidth={1.75}
          aria-hidden
        />
        <div className="min-w-0">
          <h1 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {greeting}, {userName}
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{subtext}</p>
        </div>
      </div>
    </section>
  );
}
