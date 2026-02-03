import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

interface StatCardProps {
  icon: string;
  title: string;
  value: string | number;
  color: string;
  link: string;
  t: (key: string) => string;
  index?: number;
}

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

export function StatCard({
  icon,
  title,
  value,
  color,
  link,
  t,
  index = 0,
}: StatCardProps) {
  const isNumeric = typeof value === "number";
  const isCurrency = typeof value === "string" && value.startsWith("$");
  const numericValue = isCurrency
    ? parseFloat(value.replace("$", ""))
    : isNumeric
      ? value
      : null;

  return (
    <Link to={link} className="group block">
      <div
        className="stat-card-animate bg-white dark:bg-neutral-800 overflow-hidden shadow rounded-lg transition-all duration-300 ease-out group-hover:shadow-lg group-hover:scale-[1.02] group-hover:-translate-y-1"
        style={{ animationDelay: `${index * 0.1}s` }}
      >
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span
                className={`text-2xl ${color} inline-block`}
              >
                {icon}
              </span>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-neutral-500 dark:text-neutral-400 truncate">
                  {title}
                </dt>
                <dd className="text-lg font-medium text-neutral-900 dark:text-white tabular-nums">
                  {numericValue !== null ? (
                    <>
                      {isCurrency && "$"}
                      <AnimatedNumber value={numericValue} />
                    </>
                  ) : (
                    value
                  )}
                </dd>
              </dl>
            </div>
            <div className="opacity-0 -translate-x-2 transition-all duration-300 ease-out group-hover:opacity-100 group-hover:translate-x-0">
              <svg
                className="w-5 h-5 text-neutral-400 dark:text-neutral-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-neutral-50 dark:bg-neutral-700 px-5 py-3 transition-colors duration-300 group-hover:bg-neutral-100 dark:group-hover:bg-neutral-600">
          <div className="text-sm">
            <span className={`font-medium ${color}`}>
              {t("dashboard.view")} {title.toLowerCase()}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
