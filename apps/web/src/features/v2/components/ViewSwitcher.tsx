import { Link, useRouterState } from '@tanstack/react-router';

export function ViewSwitcher({ className = '' }: { className?: string }) {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const isV2 = pathname === '/v2';

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-100/80 dark:bg-zinc-800/80 p-0.5 ${className}`}
    >
      <Link
        to="/"
        className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold leading-none transition-all duration-200 ${
          !isV2
            ? 'bg-white dark:bg-zinc-600 text-zinc-800 dark:text-zinc-100 shadow-sm'
            : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
        }`}
      >
        Classic
      </Link>
      <Link
        to="/v2"
        className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold leading-none transition-all duration-200 ${
          isV2
            ? 'bg-white dark:bg-zinc-600 text-zinc-800 dark:text-zinc-100 shadow-sm'
            : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
        }`}
      >
        Focus
      </Link>
    </div>
  );
}
