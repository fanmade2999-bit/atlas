# Atlas Handheld — current build

Atlas handheld simulation project.

## Current milestone

Physical screen + Observer/Game application layer + deterministic root climate + 16×16 tile/chunk generation + Layer 5 Interaction & Move.

## Implemented

- Atlas handheld shell with shared physical screen
- Observer: Overview, World, Climate, Systems, Inspector
- Game viewport using the same deterministic tile stream
- Root Climate
- Tile and 16×16 chunk generation
- Interaction & Move
  - one input = one tile transition
  - X wrapping
  - Y capping
  - in-memory player state
  - tick counter
  - observable last action
  - inspect action
- Unimplemented systems remain `???` / `UNPLUGGED`

## Run

```bash
npm install
npm start
```

Open `http://localhost:4173`.

## Test

```bash
npm test
```

## Controls

Observer:
- D-pad / arrows: navigate sites
- A / Enter: advance
- B / Escape: back
- Start / Select / Tab: open Game

Game:
- D-pad / arrows: move
- A / Enter: inspect
- B / Escape: return Observer
- Start / Select / Tab: return Observer

Player persistence is intentionally not implemented yet; development state is in memory.
