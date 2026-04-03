import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useAiMediaSuggestions,
  useAiMediaSuggestionsConfig,
} from "@/hooks/useMedias";
import { HttpError } from "@/lib/api/httpClient";
import { type TmdbMediaSearchItem } from "@hously/shared";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ExploreCard } from "@/pages/medias/_component/ExploreCard";

export function AiSuggestionsPanel({ onAdded }: { onAdded: () => void }) {
  const { t, i18n } = useTranslation("common");
  const [prompt, setPrompt] = useState("");
  const [mediaType, setMediaType] = useState<"movie" | "tv" | "both">("both");
  const [items, setItems] = useState<TmdbMediaSearchItem[] | null>(null);
  const [modelLabel, setModelLabel] = useState<string | null>(null);

  const mutation = useAiMediaSuggestions();
  const { data: aiConfig, isLoading: aiConfigLoading } =
    useAiMediaSuggestionsConfig();
  const ready = Boolean(aiConfig?.ready);

  if (!aiConfigLoading && !ready) return null;

  const handleGenerate = async () => {
    if (!ready) return;
    try {
      const data = await mutation.mutateAsync({
        prompt: prompt.trim() || undefined,
        media_type: mediaType,
        language: i18n.language,
      });
      setItems(data.items);
      setModelLabel(data.model);
    } catch (e) {
      const msg =
        e instanceof HttpError
          ? String(e.message)
          : t("medias.explore.aiError");
      toast.error(msg);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-neutral-950/60 ring-1 ring-white/[0.04]">
      <div className="border-b border-white/[0.06] bg-gradient-to-r from-indigo-950/40 to-transparent px-4 py-3.5 md:px-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-400/20">
            <Sparkles className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold tracking-tight text-white">
              {t("medias.explore.aiTitle")}
            </h2>
            <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">
              {t("medias.explore.aiSubtitle")}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4 md:px-5 md:py-5">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t("medias.explore.aiPromptPlaceholder")}
          rows={2}
          disabled={!ready}
          className="w-full resize-y rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2 text-[13px] text-white/90 placeholder:text-white/30 focus:border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-45"
        />

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/35">
            {t("medias.explore.aiTypeLabel")}
          </span>
          <div className="inline-flex rounded-lg border border-white/[0.08] bg-black/30 p-0.5">
            {(
              [
                ["movie", "aiTypeMovie"],
                ["tv", "aiTypeTv"],
                ["both", "aiTypeBoth"],
              ] as const
            ).map(([value, key]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMediaType(value)}
                disabled={!ready}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                  mediaType === value
                    ? "bg-indigo-500/25 text-indigo-100"
                    : "text-white/45 hover:text-white/70"
                }`}
              >
                {t(`medias.explore.${key}`)}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={mutation.isPending || !ready}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-3.5 w-3.5 opacity-90" aria-hidden />
            )}
            {t("medias.explore.aiGenerate")}
          </button>
        </div>

        {modelLabel && items && items.length > 0 && (
          <p className="text-[10px] text-white/35">
            {t("medias.explore.aiModelLabel", { model: modelLabel })}
          </p>
        )}

        {items && items.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 pt-1">
            {items.map((item) => (
              <ExploreCard key={item.id} item={item} onAdded={onAdded} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
