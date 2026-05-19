# Flappy Bird Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Flappy Bird widget to the dashboard that sits as a compact card and expands inline when played.

**Architecture:** A `useFlappyBird` hook owns all game logic and physics (no DOM access). `FlappyBirdGame` renders the canvas and runs the `requestAnimationFrame` loop. `FlappyBirdPanel` manages the collapsed/expanded toggle, high score, and mounts inside `HomePage`. Widget registry hookup (PR #196) is a follow-up note at the end.

**Tech Stack:** React 19, TypeScript, HTML Canvas API, `requestAnimationFrame`, Vitest, Tailwind CSS, Lucide icons.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `apps/web/src/features/flappy-bird/useFlappyBird.ts` | Create | All game logic: physics, collision, scoring |
| `apps/web/src/features/flappy-bird/useFlappyBird.test.ts` | Create | Unit tests for game logic hook |
| `apps/web/src/features/flappy-bird/FlappyBirdGame.tsx` | Create | Canvas renderer + rAF loop |
| `apps/web/src/pages/_component/FlappyBirdPanel.tsx` | Create | Widget shell: compact ↔ expanded state, high score |
| `apps/web/src/pages/_component/HomePage.tsx` | Modify | Import and render `FlappyBirdPanel` |

---

## Task 1: Game logic hook (TDD)

**Files:**
- Create: `apps/web/src/features/flappy-bird/useFlappyBird.ts`
- Create: `apps/web/src/features/flappy-bird/useFlappyBird.test.ts`

The hook manages all game state via a mutable ref (so the rAF loop always reads fresh values without re-renders on every frame). It exposes an immutable snapshot for React to render from, updated only on score change or game-over.

### Constants (put at the top of `useFlappyBird.ts`)

```ts
export const CANVAS_WIDTH = 360;
export const CANVAS_HEIGHT = 480;

const GRAVITY = 0.5;          // px/frame² (applied each tick)
const FLAP_VELOCITY = -9;     // px/frame (upward impulse)
const PIPE_SPEED = 2.5;       // px/frame
const PIPE_WIDTH = 52;
const PIPE_GAP = 140;         // vertical gap between top/bottom pipe
const PIPE_INTERVAL = 220;    // horizontal px between pipe pairs
const BIRD_X = 80;            // fixed horizontal position
const BIRD_SIZE = 24;         // collision hitbox (square)
```

### Types (put in `useFlappyBird.ts`)

```ts
export type GameStatus = "idle" | "playing" | "dead";

export type Pipe = {
  x: number;
  gapTop: number; // y coordinate of the top of the gap
};

export type GameState = {
  status: GameStatus;
  birdY: number;
  birdVelocity: number;
  pipes: Pipe[];
  score: number;
  nextPipeX: number; // x where next pipe spawns
};

export type FlappyBirdApi = {
  state: GameState;
  flap: () => void;
  tick: (deltaMs: number) => void; // called by rAF loop
  reset: () => void;
};
```

### Initial state factory

```ts
function initialState(): GameState {
  return {
    status: "idle",
    birdY: CANVAS_HEIGHT / 2,
    birdVelocity: 0,
    pipes: [],
    score: 0,
    nextPipeX: CANVAS_WIDTH + 80,
  };
}
```

### Hook signature

```ts
export function useFlappyBird(onGameOver: (score: number) => void): FlappyBirdApi
```

- `state` is a React state snapshot updated only when `score` changes or status changes (not every frame).
- Internal mutable ref `gameRef` holds the live game state read by `tick`.
- `flap()`: if `status === "idle"` set status to `"playing"`, always apply `FLAP_VELOCITY` to velocity.
- `tick(deltaMs)`: advance physics by `deltaMs / (1000/60)` frames, detect collisions, increment score when bird passes a pipe, spawn new pipes, call `onGameOver(score)` on collision.
- `reset()`: reset `gameRef` to `initialState()`, update React state.

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/features/flappy-bird/useFlappyBird.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useFlappyBird,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
} from "./useFlappyBird";

describe("useFlappyBird", () => {
  it("starts in idle state", () => {
    const { result } = renderHook(() => useFlappyBird(vi.fn()));
    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.score).toBe(0);
  });

  it("flap while idle transitions to playing", () => {
    const { result } = renderHook(() => useFlappyBird(vi.fn()));
    act(() => result.current.flap());
    expect(result.current.state.status).toBe("playing");
  });

  it("tick applies gravity and moves bird down", () => {
    const { result } = renderHook(() => useFlappyBird(vi.fn()));
    const initialY = result.current.state.birdY;
    act(() => {
      result.current.flap(); // start game
      result.current.tick(1000 / 60); // one frame
      result.current.tick(1000 / 60);
      result.current.tick(1000 / 60);
    });
    // after flap + gravity, bird should still be near start (flap impulse + few frames of gravity)
    // just verify tick doesn't crash and birdY changed
    expect(result.current.state.birdY).not.toBe(initialY);
  });

  it("hitting the bottom boundary triggers game over", () => {
    const onGameOver = vi.fn();
    const { result } = renderHook(() => useFlappyBird(onGameOver));
    act(() => {
      result.current.flap();
      // tick many frames to let bird fall to bottom
      for (let i = 0; i < 200; i++) result.current.tick(1000 / 60);
    });
    expect(onGameOver).toHaveBeenCalled();
    expect(result.current.state.status).toBe("dead");
  });

  it("hitting the top boundary triggers game over", () => {
    const onGameOver = vi.fn();
    const { result } = renderHook(() => useFlappyBird(onGameOver));
    act(() => {
      result.current.flap();
      // flap many times to send bird to top
      for (let i = 0; i < 50; i++) {
        result.current.flap();
        result.current.tick(1000 / 60);
      }
    });
    expect(onGameOver).toHaveBeenCalled();
  });

  it("reset returns to idle with score 0", () => {
    const { result } = renderHook(() => useFlappyBird(vi.fn()));
    act(() => {
      result.current.flap();
      result.current.tick(1000 / 60);
      result.current.reset();
    });
    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.score).toBe(0);
    expect(result.current.state.birdY).toBe(CANVAS_HEIGHT / 2);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd apps/web && bun run test src/features/flappy-bird/useFlappyBird.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `useFlappyBird.ts`**

Create `apps/web/src/features/flappy-bird/useFlappyBird.ts`:

```ts
import { useCallback, useRef, useState } from "react";

export const CANVAS_WIDTH = 360;
export const CANVAS_HEIGHT = 480;

const GRAVITY = 0.5;
const FLAP_VELOCITY = -9;
const PIPE_SPEED = 2.5;
const PIPE_WIDTH = 52;
const PIPE_GAP = 140;
const PIPE_INTERVAL = 220;
const BIRD_X = 80;
const BIRD_SIZE = 24;

export type GameStatus = "idle" | "playing" | "dead";

export type Pipe = {
  x: number;
  gapTop: number;
};

export type GameState = {
  status: GameStatus;
  birdY: number;
  birdVelocity: number;
  pipes: Pipe[];
  score: number;
  nextPipeX: number;
};

export type FlappyBirdApi = {
  state: GameState;
  flap: () => void;
  tick: (deltaMs: number) => void;
  reset: () => void;
};

function initialState(): GameState {
  return {
    status: "idle",
    birdY: CANVAS_HEIGHT / 2,
    birdVelocity: 0,
    pipes: [],
    score: 0,
    nextPipeX: CANVAS_WIDTH + 80,
  };
}

function randomGapTop(): number {
  const min = 60;
  const max = CANVAS_HEIGHT - PIPE_GAP - 60;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function checkCollision(birdY: number, pipes: Pipe[]): boolean {
  if (birdY < 0 || birdY + BIRD_SIZE > CANVAS_HEIGHT) return true;
  for (const pipe of pipes) {
    const birdRight = BIRD_X + BIRD_SIZE;
    const pipeRight = pipe.x + PIPE_WIDTH;
    if (birdRight > pipe.x && BIRD_X < pipeRight) {
      if (birdY < pipe.gapTop || birdY + BIRD_SIZE > pipe.gapTop + PIPE_GAP) {
        return true;
      }
    }
  }
  return false;
}

export function useFlappyBird(onGameOver: (score: number) => void): FlappyBirdApi {
  const gameRef = useRef<GameState>(initialState());
  const [snapshot, setSnapshot] = useState<GameState>(() => initialState());

  const syncSnapshot = useCallback(() => {
    setSnapshot({ ...gameRef.current });
  }, []);

  const flap = useCallback(() => {
    const g = gameRef.current;
    if (g.status === "dead") return;
    if (g.status === "idle") g.status = "playing";
    g.birdVelocity = FLAP_VELOCITY;
    syncSnapshot();
  }, [syncSnapshot]);

  const tick = useCallback(
    (deltaMs: number) => {
      const g = gameRef.current;
      if (g.status !== "playing") return;

      const frames = deltaMs / (1000 / 60);

      g.birdVelocity += GRAVITY * frames;
      g.birdY += g.birdVelocity * frames;

      // Move pipes
      for (const pipe of g.pipes) {
        pipe.x -= PIPE_SPEED * frames;
      }

      // Score: count pipes the bird has passed
      const prevScore = g.score;
      g.score = g.pipes.filter((p) => p.x + PIPE_WIDTH < BIRD_X).length;

      // Spawn new pipe
      g.nextPipeX -= PIPE_SPEED * frames;
      if (g.nextPipeX <= CANVAS_WIDTH) {
        g.pipes.push({ x: CANVAS_WIDTH, gapTop: randomGapTop() });
        g.nextPipeX += PIPE_INTERVAL;
      }

      // Remove off-screen pipes
      g.pipes = g.pipes.filter((p) => p.x + PIPE_WIDTH > 0);

      // Collision
      if (checkCollision(g.birdY, g.pipes)) {
        g.status = "dead";
        syncSnapshot();
        onGameOver(g.score);
        return;
      }

      if (g.score !== prevScore) syncSnapshot();
    },
    [onGameOver, syncSnapshot],
  );

  const reset = useCallback(() => {
    gameRef.current = initialState();
    syncSnapshot();
  }, [syncSnapshot]);

  return { state: snapshot, flap, tick, reset };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd apps/web && bun run test src/features/flappy-bird/useFlappyBird.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/flappy-bird/
git commit -m "feat(flappy-bird): add game logic hook with tests"
```

---

## Task 2: Canvas renderer component

**Files:**
- Create: `apps/web/src/features/flappy-bird/FlappyBirdGame.tsx`

No tests for this file — it's pure canvas drawing, not testable in jsdom. Logic is in `useFlappyBird`.

- [ ] **Step 1: Create `FlappyBirdGame.tsx`**

```tsx
import { useEffect, useRef, useCallback } from "react";
import {
  useFlappyBird,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  type GameStatus,
} from "@/features/flappy-bird/useFlappyBird";

const BIRD_X = 80;
const BIRD_SIZE = 24;
const PIPE_WIDTH = 52;
const PIPE_GAP = 140;

function drawFrame(
  ctx: CanvasRenderingContext2D,
  state: ReturnType<typeof useFlappyBird>["state"],
) {
  const { birdY, pipes, score, status } = state;

  // Background
  ctx.fillStyle = "#bde0f5";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Ground
  ctx.fillStyle = "#8BC34A";
  ctx.fillRect(0, CANVAS_HEIGHT - 20, CANVAS_WIDTH, 20);

  // Pipes
  ctx.fillStyle = "#4CAF50";
  for (const pipe of pipes) {
    // Top pipe
    ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.gapTop);
    // Bottom pipe
    ctx.fillRect(
      pipe.x,
      pipe.gapTop + PIPE_GAP,
      PIPE_WIDTH,
      CANVAS_HEIGHT - pipe.gapTop - PIPE_GAP,
    );
    // Pipe caps
    ctx.fillStyle = "#388E3C";
    ctx.fillRect(pipe.x - 4, pipe.gapTop - 12, PIPE_WIDTH + 8, 12);
    ctx.fillRect(pipe.x - 4, pipe.gapTop + PIPE_GAP, PIPE_WIDTH + 8, 12);
    ctx.fillStyle = "#4CAF50";
  }

  // Bird
  ctx.fillStyle = status === "dead" ? "#e53935" : "#FFC107";
  ctx.beginPath();
  ctx.roundRect(BIRD_X, birdY, BIRD_SIZE, BIRD_SIZE, 6);
  ctx.fill();

  // Eye
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(BIRD_X + 16, birdY + 7, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(BIRD_X + 17, birdY + 7, 2, 0, Math.PI * 2);
  ctx.fill();

  // Score
  ctx.fillStyle = "#fff";
  ctx.font = "bold 20px monospace";
  ctx.textAlign = "left";
  ctx.fillText(String(score), 12, 30);
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  status: GameStatus,
  score: number,
  highScore: number,
) {
  if (status === "idle") {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Click or Space to start", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  }

  if (status === "dead") {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Game Over", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
    ctx.font = "18px monospace";
    ctx.fillText(`Score: ${score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.fillText(`Best: ${highScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 28);
    ctx.font = "14px monospace";
    ctx.fillStyle = "#FFC107";
    ctx.fillText("Click or Space to retry", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 64);
  }
}

type Props = {
  highScore: number;
  onGameOver: (score: number) => void;
};

export function FlappyBirdGame({ highScore, onGameOver }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const { state, flap, tick, reset } = useFlappyBird(onGameOver);
  const stateRef = useRef(state);
  stateRef.current = state;

  const handleInput = useCallback(() => {
    if (stateRef.current.status === "dead") {
      reset();
    } else {
      flap();
    }
  }, [flap, reset]);

  // rAF loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = (time: number) => {
      const delta = lastTimeRef.current ? time - lastTimeRef.current : 1000 / 60;
      lastTimeRef.current = time;

      const currentState = stateRef.current;
      tick(delta);
      drawFrame(ctx, currentState);
      drawOverlay(ctx, currentState.status, currentState.score, highScore);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick, highScore]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        handleInput();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleInput]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      onClick={handleInput}
      className="cursor-pointer block"
      aria-label="Flappy Bird game"
    />
  );
}
```

- [ ] **Step 2: Verify it type-checks**

```bash
cd apps/web && bun run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/flappy-bird/FlappyBirdGame.tsx
git commit -m "feat(flappy-bird): add canvas renderer component"
```

---

## Task 3: Widget panel shell

**Files:**
- Create: `apps/web/src/pages/_component/FlappyBirdPanel.tsx`

- [ ] **Step 1: Create `FlappyBirdPanel.tsx`**

```tsx
import { useState, useCallback } from "react";
import { X, Gamepad2 } from "lucide-react";
import { FlappyBirdGame } from "@/features/flappy-bird/FlappyBirdGame";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/features/flappy-bird/useFlappyBird";

export function FlappyBirdPanel() {
  const [expanded, setExpanded] = useState(false);
  const [highScore, setHighScore] = useState(0);

  const handleGameOver = useCallback((score: number) => {
    setHighScore((prev) => Math.max(prev, score));
  }, []);

  const open = () => setExpanded(true);
  const close = () => setExpanded(false);

  if (!expanded) {
    return (
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <span className="w-1 h-4 rounded-full bg-yellow-400 shrink-0" />
            <Gamepad2 className="w-4 h-4 shrink-0 text-zinc-500 dark:text-zinc-400" strokeWidth={2} />
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              Flappy Bird
            </h3>
          </div>
          {highScore > 0 && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
              Best: {highScore}
            </span>
          )}
        </div>
        <div className="px-4 py-6 flex flex-col items-center gap-3">
          <span className="text-3xl select-none">🐦</span>
          <button
            onClick={open}
            className="px-4 py-1.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-zinc-900 text-sm font-semibold transition-colors"
          >
            Play
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-4 rounded-full bg-yellow-400 shrink-0" />
          <Gamepad2 className="w-4 h-4 shrink-0 text-zinc-500 dark:text-zinc-400" strokeWidth={2} />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Flappy Bird
          </h3>
          {highScore > 0 && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono ml-1">
              Best: {highScore}
            </span>
          )}
        </div>
        <button
          onClick={close}
          aria-label="Close game"
          className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
      <div
        className="flex justify-center bg-zinc-50 dark:bg-zinc-950"
        style={{ width: CANVAS_WIDTH, maxWidth: "100%" }}
      >
        <FlappyBirdGame highScore={highScore} onGameOver={handleGameOver} />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && bun run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/_component/FlappyBirdPanel.tsx
git commit -m "feat(flappy-bird): add widget panel shell with compact/expanded states"
```

---

## Task 4: Wire into HomePage

**Files:**
- Modify: `apps/web/src/pages/_component/HomePage.tsx`

- [ ] **Step 1: Add import**

In `HomePage.tsx`, add to the existing import block (after `MinecraftCompactPanel` import):

```ts
import { FlappyBirdPanel } from "@/pages/_component/FlappyBirdPanel";
```

- [ ] **Step 2: Add widget to the right column**

In the right column of `HomePage`, add `FlappyBirdPanel` after `MinecraftCompactPanel`:

```tsx
            <motion.div variants={panelVariants}>
              <CardErrorBoundary>
                <MinecraftCompactPanel />
              </CardErrorBoundary>
            </motion.div>

            <motion.div variants={panelVariants}>
              <CardErrorBoundary>
                <FlappyBirdPanel />
              </CardErrorBoundary>
            </motion.div>
```

- [ ] **Step 3: Type-check and lint**

```bash
cd apps/web && bun run typecheck && bun run lint
```

Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/_component/HomePage.tsx
git commit -m "feat(flappy-bird): add FlappyBirdPanel to dashboard"
```

---

## Task 5: Manual smoke test

- [ ] **Step 1: Start dev server**

```bash
make dev-web
```

- [ ] **Step 2: Verify compact state**

Open the dashboard. Confirm:
- Flappy Bird card appears in the right column
- Shows bird emoji and "Play" button
- High score label is hidden when score is 0

- [ ] **Step 3: Verify gameplay**

Click "Play". Confirm:
- Card expands inline, other widgets shift down
- Canvas renders (blue sky, ground, bird)
- "Click or Space to start" overlay appears
- Pressing Space or clicking starts the game
- Bird falls with gravity, flap impulse works
- Pipes appear and scroll left
- Score increments when passing pipes
- Hitting a pipe or boundary shows "Game Over" overlay with score and high score
- Clicking/Space after death resets and starts a new round
- × button collapses back to compact card
- High score persists in the compact card after collapsing

- [ ] **Step 4: Run full test suite**

```bash
cd apps/web && bun run test
```

Expected: all tests pass including the new `useFlappyBird` tests.

---

## Widget Registry Note (follow-up after PR #196 merges)

When PR #196 merges, register the widget in the registry by adding an entry to the widget registry config with:

```ts
{
  id: "flappy-bird",
  defaultVisibility: "visible",
  component: FlappyBirdPanel,
}
```

And remove the direct import + `motion.div` block added to `HomePage.tsx` in Task 4, replacing it with the registry-driven render.
