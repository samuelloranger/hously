import { useEffect, useRef, useCallback } from "react";
import {
  useFlappyBird,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BIRD_X,
  BIRD_SIZE,
  PIPE_WIDTH,
  PIPE_GAP,
  GROUND_HEIGHT,
  type GameStatus,
} from "@/features/flappy-bird/useFlappyBird";

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
  ctx.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, GROUND_HEIGHT);

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
    ctx.fillText(
      "Click or Space to start",
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2,
    );
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
    ctx.fillText(
      `Best: ${highScore}`,
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 + 28,
    );
    ctx.font = "14px monospace";
    ctx.fillStyle = "#FFC107";
    ctx.fillText(
      "Click or Space to retry",
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2 + 64,
    );
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
  const highScoreRef = useRef(highScore);
  // eslint-disable-next-line react-hooks/refs
  highScoreRef.current = highScore;

  const { state, flap, tick, reset } = useFlappyBird(onGameOver);
  const stateRef = useRef(state);
  // eslint-disable-next-line react-hooks/refs
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
      const delta = lastTimeRef.current
        ? time - lastTimeRef.current
        : 1000 / 60;
      lastTimeRef.current = time;

      const currentState = stateRef.current;
      tick(delta);
      drawFrame(ctx, currentState);
      drawOverlay(
        ctx,
        currentState.status,
        currentState.score,
        highScoreRef.current,
      );

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

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
