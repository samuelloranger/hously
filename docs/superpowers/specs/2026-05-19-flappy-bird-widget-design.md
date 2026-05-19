# Flappy Bird Widget — Design Spec

**Date:** 2026-05-19
**Status:** Approved

---

## Overview

A Flappy Bird clone rendered inside a dashboard widget. The widget sits in the 3-column dashboard grid in its compact state and expands inline (pushing widgets below it down) when the user starts playing. High score is stored in memory only — resets on page reload. Integrates with the widget registry introduced in PR #196.

---

## Widget Registry Integration

- **Widget ID:** `flappy-bird`
- **Default visibility:** `visible`
- **Column placement:** any column (no fixed column requirement)
- Registered in the widget registry alongside existing widgets; admin-toggleable like all others

---

## States

### Compact (default)

Rendered as a standard dashboard card matching the style of other panels (rounded corners, consistent padding, same background).

Contains:
- Widget title: "Flappy Bird"
- Session high score (e.g. "Best: 0")
- A "Play" button

### Expanded (playing)

Triggered by clicking "Play". The card grows in place to a fixed **360 × 480 px** play area, pushing widgets below it down. No modal, no overlay.

Contains:
- A `<canvas>` element filling the play area
- Current score displayed top-left of the canvas
- High score displayed top-right of the canvas
- An **×** button (top-right corner of the card) to collapse back to compact state

### Game Over

Displayed inside the canvas after a collision. Card remains expanded.

Contains:
- "Game Over" message
- Final score
- Session high score
- "Try Again" button — restarts immediately without collapsing

---

## Game Mechanics

Implemented with `requestAnimationFrame` and a `<canvas>` element. No external game library.

| Property | Value |
|---|---|
| Canvas size | 360 × 480 px |
| Gravity | Constant downward acceleration each frame |
| Flap | Upward velocity impulse on Space or click/tap |
| Pipe speed | Constant leftward scroll |
| Pipe gap | Fixed height |
| Score | +1 each time the bird clears a pipe pair |
| Collision | Pipe edges or canvas top/bottom boundary → game over |
| Frame rate | `requestAnimationFrame` (uncapped, delta-time corrected) |

Pipes are generated at a fixed horizontal interval and recycled off-screen.

---

## Component Structure

```
src/pages/_component/
└── FlappyBirdPanel.tsx       # Widget shell (compact ↔ expanded state)

src/features/flappy-bird/
├── FlappyBirdGame.tsx        # Canvas component + game loop
└── useFlappyBird.ts          # Game state, physics, input handling
```

`FlappyBirdPanel` manages the collapsed/expanded toggle and high score state.
`FlappyBirdGame` owns the `<canvas>` ref and `requestAnimationFrame` loop, delegating all logic to `useFlappyBird`.
`useFlappyBird` is a pure game-logic hook — no DOM access, testable in isolation.

---

## Data Flow

```
user input (Space / click)
    → useFlappyBird (apply flap impulse)
    → requestAnimationFrame tick (update positions, check collisions)
    → FlappyBirdGame (draw frame to canvas)
    → FlappyBirdPanel (receives onGameOver(score) → updates highScore if higher)
```

High score lives in `FlappyBirdPanel` as `useState`. No persistence, no API call.

---

## Error Handling

- If the browser doesn't support `<canvas>`, render a fallback message ("Your browser doesn't support this widget").
- If the component unmounts mid-game (e.g. widget hidden), cancel the `requestAnimationFrame` loop via cleanup in `useEffect`.

---

## Testing

- `useFlappyBird` unit tests: verify gravity applies correctly, flap resets velocity, collision detection triggers game over at boundaries and pipe edges.
- No visual/canvas tests required — the hook covers the logic surface.
