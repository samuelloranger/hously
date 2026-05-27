import { useState } from "react";
import { Sparkles, AlertTriangle, RefreshCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { InteractiveReleaseItem } from "@hously/shared/types";

interface AiPickBannerProps {
  isLoading: boolean;
  isError: boolean;
  release: InteractiveReleaseItem | null;
  reasoning: string | null;
  grabBusy: boolean;
  onGrab: (release: InteractiveReleaseItem) => void;
  onRetry: () => void;
  onDismiss: () => void;
}

export function AiPickBanner({
  isLoading,
  isError,
  release,
  reasoning,
  grabBusy,
  onGrab,
  onRetry,
  onDismiss,
}: AiPickBannerProps) {
  const [grabbed, setGrabbed] = useState(false);

  if (!isLoading && !isError && !release) return null;

  const handleGrab = (r: InteractiveReleaseItem) => {
    onGrab(r);
    setGrabbed(true);
    setTimeout(() => onDismiss(), 1800);
  };

  return (
    <div
      className={cn(
        "mb-3 rounded-lg border px-4 py-3 text-sm",
        isError
          ? "border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400"
          : "border-violet-500/30 bg-violet-500/5",
      )}
    >
      {isLoading && (
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 animate-pulse text-violet-500" />
          <span className="text-sm text-neutral-500 dark:text-neutral-400 animate-pulse">
            AI is analyzing releases…
          </span>
        </div>
      )}

      {isError && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Could not get response from AI</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={onRetry}
          >
            <RefreshCcw className="h-3 w-3" />
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !isError && release && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {grabbed ? (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <Check className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">Grabbed ✓</span>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2 min-w-0">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                <div className="min-w-0">
                  <span className="font-medium text-violet-700 dark:text-violet-300">
                    AI Pick:{" "}
                  </span>
                  <span className="break-all text-xs text-neutral-700 dark:text-neutral-300">
                    {release.title}
                  </span>
                  {reasoning && (
                    <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      {reasoning}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  className="h-7 gap-1 bg-violet-600 hover:bg-violet-700 text-white text-xs"
                  disabled={grabBusy}
                  onClick={() => handleGrab(release)}
                >
                  <Sparkles className="h-3 w-3" />
                  AI Grab
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-neutral-400"
                  onClick={onDismiss}
                  aria-label="Dismiss"
                >
                  ×
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
