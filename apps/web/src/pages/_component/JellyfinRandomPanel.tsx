import { Shuffle, Tv2, ExternalLink } from "lucide-react";
import { useJellyfinRandom } from "@/pages/_component/useJellyfinRandom";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

function Skeleton() {
  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <span className="w-1 h-4 rounded-full bg-orange-500 shrink-0" />
        <Tv2
          className="w-4 h-4 shrink-0 text-zinc-500 dark:text-zinc-400"
          strokeWidth={2}
        />
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          What to Watch?
        </h3>
      </div>
      <div className="p-4 flex gap-4">
        <div className="w-20 h-28 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 w-3/4 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          <div className="h-3 w-1/4 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          <div className="h-3 w-full rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          <div className="h-3 w-5/6 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        </div>
      </div>
    </section>
  );
}

export function JellyfinRandomPanel() {
  const queryClient = useQueryClient();
  const { data, isPending, isFetching } = useJellyfinRandom();

  if (isPending) return <Skeleton />;
  if (!data?.enabled || !data.item) return null;

  const { item } = data;

  const shuffle = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.dashboard.jellyfinRandom(),
    });
  };

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-4 rounded-full bg-orange-500 shrink-0" />
          <Tv2
            className="w-4 h-4 shrink-0 text-zinc-500 dark:text-zinc-400"
            strokeWidth={2}
          />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            What to Watch?
          </h3>
        </div>
        <button
          onClick={shuffle}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors disabled:opacity-40"
          title="Shuffle"
        >
          <Shuffle size={13} className={isFetching ? "animate-spin" : ""} />
          Roll again
        </button>
      </div>

      <div className="p-4 flex gap-4">
        {item.poster_url ? (
          <img
            src={item.poster_url}
            alt={item.title}
            className="w-20 h-28 object-cover rounded-lg shrink-0 bg-zinc-100 dark:bg-zinc-800"
          />
        ) : (
          <div className="w-20 h-28 rounded-lg bg-zinc-100 dark:bg-zinc-800 shrink-0 flex items-center justify-center">
            <Tv2 size={24} className="text-zinc-400" />
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-tight line-clamp-2">
              {item.title}
            </p>
            {item.item_url && (
              <a
                href={item.item_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-zinc-400 hover:text-orange-500 transition-colors mt-0.5"
              >
                <ExternalLink size={13} />
              </a>
            )}
          </div>
          {item.year && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              {item.year}
            </p>
          )}
          {(item.overview ?? item.subtitle) && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-4 leading-relaxed">
              {item.overview ?? item.subtitle}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
