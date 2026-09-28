# Atlas Handheld — current build

Atlas handheld simulation project.

## Current milestone

Physical screen + Observer/Game application layer + deterministic root climate + 16×16 tile/chunk generation + Layer 3 physical naming hierarchy + Layer 4 terrain/hydrology + Layer 5 Interaction & Move.

## Implemented

- Atlas handheld shell with shared physical screen
- Observer: Overview, World, Climate, Systems, Inspector
- Game viewport using the same deterministic tile stream
- Root Climate
- Tile and 16×16 chunk generation
- Layer 3 physical naming hierarchy
  - Continent → Territory → Region → Tract → Area → Chunk → Tile
  - Continent identity derived from a coarse connected physical landmass field
  - Territory / Region / Tract / Area use deterministic macro physical terrain/biome types
  - named-tier size caps: 2,000 km / 400 km / 80 km / 8 km
  - deterministic organic vs directional split classification
  - Chunk and Tile remain intentionally unnamed
  - ocean tiles expose `???` for unavailable land-based named tiers
- Layer 4 terrain + hydrology
  - landform bands
  - deterministic downhill flow
  - lake / river / swamp / ocean / shallows classification
  - watershed identity
- Interaction & Move
  - one input = one tile transition
  - deterministic passable / non-passable terrain
  - server-enforced movement collision
  - blocked movement leaves player position unchanged
  - X wrapping
  - Y capping
  - in-memory player state
  - live tick counter
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

- `/` → Game application
- `/game.html` → Game application directly
- `/observer.html` → Observer application
- `/api/game`, `/api/game/move`, `/api/game/inspect` → Game API routes for static/serverless deployment
- `/api/observer` → Observer API route

Game input is app-scoped: while Game is active, D-pad/arrow input moves the player; A inspects; B/START/SELECT return to Observer. The Game app also polls the browser Gamepad API rather than relying on keyboard events.

## Screen architecture

Game and Observer are two app states inside one physical handheld screen. The shell stays mounted while `state.mode` switches the screen between `GAME` and `OBSERVER`. `/game.html` is only a compatibility entry that redirects into the same shell with `?app=game`.

## Current implementation notes

- The physical screen is fixed; the Observer information region scrolls independently; the physical gamepad is fixed.
- D-pad/arrow movement is gameplay-only and never changes Observer sections. Observer sections are changed by the on-screen tabs/touch UI.
- XYZ/tick is a compact HUD overlay on the world viewport.
- World tiles are rendered as square cells.
- Layer 3 naming is now **PASS** for the current physical naming contract. Named tiers are derived from deterministic macro terrain/biome information; ocean tiles do not invent land-based names.
- Layer 4 terrain/hydrology is **PASS** for the current deterministic terrain contract. It is not a full global fluid/erosion simulation.

## Runtime timing

Atlas exposes a live development simulation clock at 20 ticks per second. The tick is derived from elapsed simulation time rather than player input, so it continues advancing while the player is idle. The Observer polls live state and displays the current tick, simulation time, and tick rate.

## Movement presentation

Movement has separate authoritative and visual layers: the server accepts the one-tile transition immediately, while the handheld renders a short step animation and a fading ghost at the previous tile. The world-state coordinates remain exact during this visual transition.

## Chunk borders

Every 16×16 chunk boundary is drawn on the game grid. This is a debug visualization of the same chunk coordinates used by the streaming cache.

### Current runtime/performance work

- Observer panels refresh from a lightweight realtime snapshot every 500 ms; the simulation clock remains server-authoritative at 20 TPS.
- Movement is serialized client-side so concurrent input cannot apply stale responses out of order.
- Root climate, terrain transforms, tile self-tests, and naming fields use bounded caches.
- Neighboring 16×16 chunks are prefetched after a chunk transition so crossing a boundary does not need to present a generation screen.
- Layer 6 has a runtime data-first ECS core; spawning/species simulation is still separate and remains unimplemented.
- Generated tiles expose Layer 4 `landform`, `waterform`, and `surface` fields.
