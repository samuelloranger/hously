import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { usePrefetchRoute } from '../../../hooks/usePrefetchRoute';

interface StatCardProps {
  icon: string;
  title: string;
  value: string | number;
  color: string;
  link: string;
  t: (key: string) => string;
  index?: number;
}

const cardThemes = [
  // Events — warm amber/peach
  {
    card: 'from-[#fff7ed] via-[#fff3e6] to-[#ffecd2] dark:from-amber-950/50 dark:via-orange-950/35 dark:to-amber-900/25 border-amber-200/80 dark:border-amber-700/40',
    value: 'text-amber-900 dark:text-amber-100',
    label: 'text-amber-800/70 dark:text-amber-300/70',
    icon: 'bg-amber-200/60 dark:bg-amber-800/40',
    arrow: 'text-amber-500/60 dark:text-amber-400/50',
    glow: 'group-hover:shadow-amber-200/40 dark:group-hover:shadow-amber-800/20',
  },
  // Shopping — cool blue/sky
  {
    card: 'from-[#eff6ff] via-[#e8f1ff] to-[#dbeafe] dark:from-blue-950/50 dark:via-sky-950/35 dark:to-blue-900/25 border-blue-200/80 dark:border-blue-700/40',
    value: 'text-blue-900 dark:text-blue-100',
    label: 'text-blue-800/70 dark:text-blue-300/70',
    icon: 'bg-blue-200/60 dark:bg-blue-800/40',
    arrow: 'text-blue-500/60 dark:text-blue-400/50',
    glow: 'group-hover:shadow-blue-200/40 dark:group-hover:shadow-blue-800/20',
  },
  // Chores — fresh green/emerald
  {
    card: 'from-[#ecfdf5] via-[#e6faf0] to-[#d1fae5] dark:from-emerald-950/50 dark:via-green-950/35 dark:to-emerald-900/25 border-emerald-200/80 dark:border-emerald-700/40',
    value: 'text-emerald-900 dark:text-emerald-100',
    label: 'text-emerald-800/70 dark:text-emerald-300/70',
    icon: 'bg-emerald-200/60 dark:bg-emerald-800/40',
    arrow: 'text-emerald-500/60 dark:text-emerald-400/50',
    glow: 'group-hover:shadow-emerald-200/40 dark:group-hover:shadow-emerald-800/20',
  },
];

function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const startTime = useRef<number | null>(null);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const duration = 800;
    const startValue = displayValue;
    const endValue = value;

    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const progress = Math.min((timestamp - startTime.current) / duration, 1);

      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (endValue - startValue) * easeOut);

      setDisplayValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    startTime.current = null;
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value]);

  return <span>{displayValue}</span>;
}

export function StatCard({ icon, title, value, color: _color, link, t, index = 0 }: StatCardProps) {
  const prefetchRoute = usePrefetchRoute();
  const isNumeric = typeof value === 'number';
  const isCurrency = typeof value === 'string' && value.startsWith('$');
  const numericValue = isCurrency ? parseFloat(value.replace('$', '')) : isNumeric ? value : null;
  const theme = cardThemes[index] || cardThemes[0];

  return (
    <Link
      to={link}
      className="group block"
      onMouseEnter={() => prefetchRoute(link)}
      onTouchStart={() => prefetchRoute(link)}
    >
      <div
        className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${theme.card} ${theme.glow} p-4 transition-all duration-300 ease-out group-hover:shadow-lg group-hover:scale-[1.02] group-hover:-translate-y-0.5`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${theme.icon} text-base`}>{icon}</div>
            <div>
              <p className={`text-[11px] font-medium uppercase tracking-wide ${theme.label}`}>{title}</p>
              <p className={`text-xl font-bold tabular-nums ${theme.value}`}>
                {numericValue !== null ? (
                  <>
                    {isCurrency && '$'}
                    <AnimatedNumber value={numericValue} />
                  </>
                ) : (
                  value
                )}
              </p>
            </div>
          </div>
          <div
            className={`transition-all duration-300 ease-out opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 ${theme.arrow}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
        <p className={`mt-1.5 text-[11px] font-medium ${theme.label}`}>{t('dashboard.view')} →</p>
      </div>
    </Link>
  );
}
