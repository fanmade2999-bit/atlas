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


## Current implementation notes

- The physical screen is fixed; the Observer information region scrolls independently; the physical gamepad is fixed.
- D-pad/arrow movement is gameplay-only and never changes Observer sections. Observer sections are changed by the on-screen tabs/touch UI.
- XYZ/tick is a compact HUD overlay on the world viewport.
- World tiles are rendered as square cells.
- Layer 3 Naming Hierarchy is now **PARTIAL**: deterministic physical tier naming is implemented and exposed through Observer (`Continent → Territory → Region → Tract → Area → Chunk → Tile`), while organic/directional split resolution remains to be completed because it depends on broader terrain variation data.


## Runtime timing

Atlas now exposes a live development simulation clock at **20 ticks per second**. The tick is derived from elapsed simulation time rather than player input, so it continues advancing while the player is idle. The Observer polls live state and displays the current tick, simulation time, and tick rate.

## Movement presentation

Movement has separate authoritative and visual layers: the server accepts the one-tile transition immediately, while the handheld renders a short step animation and a fading ghost at the previous tile. The world-state coordinates remain exact during this visual transition.

## Chunk borders

Every 16×16 chunk boundary is drawn on the game grid. This is a debug visualization of the same chunk coordinates used by the streaming cache.


### Current runtime/performance work
- Observer panels refresh from a lightweight realtime snapshot every 500 ms; the simulation clock remains server-authoritative at 20 TPS.
- Movement is serialized client-side so concurrent input cannot apply stale responses out of order.
- Root climate, terrain transforms, and tile self-tests use bounded LRU-style caches.
- Neighboring 16×16 chunks are prefetched after a chunk transition so crossing a boundary does not need to present a generation screen.
- Layer 6 now has a runtime data-first ECS core; spawning/species simulation is still separate and remains unimplemented.
- Generated tiles now expose Layer 4 `landform`, `waterform`, and `surface` fields.
