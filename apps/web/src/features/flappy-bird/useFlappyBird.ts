import { useCallback, useRef, useState } from "react";

export const CANVAS_WIDTH = 360;
export const CANVAS_HEIGHT = 480;

const GRAVITY = 0.5;
const FLAP_VELOCITY = -9;
const PIPE_SPEED = 2.5;
export const PIPE_WIDTH = 52;
export const PIPE_GAP = 140;
const PIPE_INTERVAL = 220;
export const BIRD_X = 80;
export const BIRD_SIZE = 24;
const FIRST_PIPE_DELAY_PX = 80; // grace distance before first pipe appears

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

function initialState(): GameState {
  return {
    status: "idle",
    birdY: CANVAS_HEIGHT / 2,
    birdVelocity: 0,
    pipes: [],
    score: 0,
    nextPipeX: CANVAS_WIDTH + FIRST_PIPE_DELAY_PX,
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

export function useFlappyBird(
  onGameOver: (score: number) => void,
): FlappyBirdApi {
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

      for (const pipe of g.pipes) {
        pipe.x -= PIPE_SPEED * frames;
      }

      g.score = g.pipes.filter((p) => p.x + PIPE_WIDTH < BIRD_X).length;

      g.nextPipeX -= PIPE_SPEED * frames;
      if (g.nextPipeX <= CANVAS_WIDTH) {
        g.pipes.push({ x: CANVAS_WIDTH, gapTop: randomGapTop() });
        g.nextPipeX += PIPE_INTERVAL;
      }

      g.pipes = g.pipes.filter((p) => p.x + PIPE_WIDTH > 0);

      if (checkCollision(g.birdY, g.pipes)) {
        g.status = "dead";
        syncSnapshot();
        onGameOver(g.score);
        return;
      }

      syncSnapshot();
    },
    [onGameOver, syncSnapshot],
  );

  const reset = useCallback(() => {
    gameRef.current = initialState();
    syncSnapshot();
  }, [syncSnapshot]);

  return { state: snapshot, flap, tick, reset };
}
