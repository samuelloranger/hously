import { useState, useCallback } from "react";
import { X, Gamepad2 } from "lucide-react";
import { FlappyBirdGame } from "@/features/flappy-bird/FlappyBirdGame";
import { CANVAS_WIDTH } from "@/features/flappy-bird/useFlappyBird";

export function FlappyBirdPanel() {
  const [expanded, setExpanded] = useState(false);
  const [highScore, setHighScore] = useState(0);

  const handleGameOver = useCallback((score: number) => {
    setHighScore((prev) => Math.max(prev, score));
  }, []);

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-4 rounded-full bg-yellow-400 shrink-0" />
          <Gamepad2
            className="w-4 h-4 shrink-0 text-zinc-500 dark:text-zinc-400"
            strokeWidth={2}
          />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Flappy Bird
          </h3>
          {highScore > 0 && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono ml-1">
              Best: {highScore}
            </span>
          )}
        </div>
        {expanded && (
          <button
            onClick={() => setExpanded(false)}
            aria-label="Close game"
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {expanded ? (
        <div
          className="flex justify-center bg-zinc-50 dark:bg-zinc-950"
          style={{ width: "100%", maxWidth: CANVAS_WIDTH }}
        >
          <FlappyBirdGame highScore={highScore} onGameOver={handleGameOver} />
        </div>
      ) : (
        <div className="px-4 py-6 flex flex-col items-center gap-3">
          <span className="text-3xl select-none">🐦</span>
          <button
            onClick={() => setExpanded(true)}
            className="px-4 py-1.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-zinc-900 text-sm font-semibold transition-colors"
          >
            Play
          </button>
        </div>
      )}
    </section>
  );
}
