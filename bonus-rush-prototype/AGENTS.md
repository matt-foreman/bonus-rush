# Bonus Rush Agent Guide

## Bonus Rush Rules

- Ladder order is linear: players progress from rung 1 upward.
- A puzzle is identified by `puzzleId` and should be routable.
- Results are always scoped to a completed `puzzleId`.
- Keep puzzle state deterministic and serializable for easy replay.
- Avoid hidden scoring changes; scoring updates must be explicit in code.

## Development Conventions

- Stack: React + TypeScript + Vite.
- Routing: use `react-router-dom` with route params for puzzle-specific views.
- Folder ownership:
  - `src/pages` for route handlers only.
  - `src/components` for reusable UI blocks.
  - `src/data` for constants/mock content.
  - `src/state` for stores/reducers/hooks controlling game state.
  - `src/types` for shared domain types.
  - `src/utils` for pure utility functions.
  - `src/styles` for global theme files.
- Styling:
  - Use CSS variables for theme tokens.
  - Prefer calm nature palette and rounded components.
  - Keep tile visuals wood-inspired and readable.
- Quality:
  - Keep strict TypeScript enabled.
  - Add/update docs when routes or rules change.
  - Keep page components small and move shared logic to `components` or `utils`.
