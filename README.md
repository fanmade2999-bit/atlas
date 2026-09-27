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


## Direct game screen

The playable handheld world is also available directly at `/game.html`. It uses the same `/api/game` and movement/inspect endpoints as the main shell, so a deployment can open the game screen immediately.

## Application routes

- `/` → Game application (playable world)
- `/game.html` → Game application directly
- `/observer.html` → Observer application
- `/api/game`, `/api/game/move`, `/api/game/inspect` → Game API routes for static/serverless deployment
- `/api/observer` → Observer API route

Game input is app-scoped: while Game is active, D-pad/arrow input moves the player; A inspects; B/START/SELECT return to Observer. The Game app also polls the browser Gamepad API rather than relying on keyboard events.


## Screen architecture

Game and Observer are now two app states inside one physical handheld screen. They are not separate screen documents: the shell stays mounted while `state.mode` switches the screen between `GAME` and `OBSERVER`. `/game.html` is only a compatibility entry that redirects into the same shell with `?app=game`.
