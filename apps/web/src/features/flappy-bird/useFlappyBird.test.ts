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
    expect(result.current.state.birdY).not.toBe(initialY);
  });

  it("hitting the bottom boundary triggers game over", () => {
    const onGameOver = vi.fn();
    const { result } = renderHook(() => useFlappyBird(onGameOver));
    act(() => {
      result.current.flap();
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
