# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A 3D driving-game portfolio for Asit Minz (Cloud & Infrastructure Engineer, Bangalore). The visitor drives a car through a desert world where each named zone is a resume section; there's also a racing circuit with a global leaderboard, a bowling mini-game, visitor-left comments placed in the world, and a live visitor counter. Heavily inspired by folio-2025 (Bruno Simon-style portfolio) — several in-code comments reference "folio" for design decisions.

Stack: React 18 + Vite 6, Three.js via @react-three/fiber (R3F) + drei, physics via @react-three/rapier (Rapier WASM), Zustand for state, Howler for audio, Tailwind 4 (mostly inline styles in practice). Backend is Vercel serverless functions (`api/`) + Upstash Redis. Deployed on Vercel (project `asit-portfolio`, linked in `.vercel/project.json`).

**Before any visual, UI, motion, or audio work, read `DESIGN.md`** — the design system extracted from folio-2025's source, with this project's own token values and non-negotiable UX rules (never interrupt driving, graceful offline states, typing guard, mobile parity, draw-call budgets).

## Commands

```bash
npm run dev       # dev server (localhost:5173)
npm run build     # production build → dist/
npm run preview   # preview production build
npx eslint src    # lint (no npm script; eslint.config.js at root)
```

There are no tests. Local dev has no Redis credentials by default, so leaderboard/comments/visitor APIs return null and the UI shows its offline states — that's expected. To exercise the API routes locally you need `vercel dev` plus `vercel env pull` (requires `vercel login`; the CLI in dependencies is v32).

## Big-picture architecture

### Two render worlds, one store

`App.jsx` is the DOM shell: it mounts `<KeyboardControls>` → `<Canvas>` → `Scene.jsx` (everything 3D), and, alongside the canvas, the 2D HUD/overlay components (`ZoneOverlay`, `LapTimerHUD`, `AchievementSystem`, `WhisperInput`, `NosHUD`, `MapOverlay`, `MusicPlayer`, `MobileJoystick`, `StartScreen`). The two worlds communicate through:

1. **`src/store/useGameStore.js` (Zustand)** — the single state hub. Holds zone state, game lifecycle (`gameStarted`), mobile joystick state, race state machine (`raceState: idle|racing|finished`), best/last lap, `pendingLeaderboardSubmit`, achievements (`visitedZones`, `strikeCount`), comment state (`whisperInputOpen`, `whispers`), and the vehicle's Rapier body handle (`vehicleBody`). Several components write directly via `useGameStore.setState(...)` rather than through actions — that's an established pattern here, not an accident.
   - The store also exports `ZONES`: **this object is the resume content** (experience, projects, contact info). Edit resume text there, not in components.

2. **`window.__*` globals for per-frame values** — values that change every frame are deliberately NOT routed through Zustand (would re-render React every frame). Current globals: `__carPosition` (written by `Whispers.jsx`), `__nosLevel` / `__isBoosting` (written by `Vehicle.jsx`, read by `NosHUD` and the animated `document.title`), `__raceElapsedMs` (written by `Circuit.jsx`, polled by `LapTimerHUD` on a 50 ms interval), `__resetCar` (set by App's R-key handler, consumed in `Vehicle.jsx`'s frame loop). Note: the store has `needsReset`/`resetCar` intended to replace `__resetCar`, but the global is still what's actually wired up.

### Input

Two parallel input paths, and both must respect text fields:
- **drei `KeyboardControls`** (`src/Controls.js` keyMap: WASD/arrows, Space brake, Shift boost) polled via `getKeys()` in `Vehicle.jsx`. On mobile, a joystick + boost button write the same shape into `store.joystick`, OR-merged with keys in `Vehicle.getInput()`.
- **A global `keydown` listener in `App.jsx`**: R = reset car, M = music toggle, C = open comment input, Tab = map.

**Typing guard (do not regress):** both `App.jsx`'s keydown handler and `Vehicle.jsx`'s `getInput()` bail out when `document.activeElement` / `e.target` is an INPUT/TEXTAREA/contentEditable. Without this, typing in the comment box or leaderboard name field resets the car (R), reopens the comment box (C), and drives/brakes the car (WASD/Space). Any new global hotkey or input consumer must keep this guard.

### Vehicle physics (`Vehicle.jsx`)

Rapier **raycast vehicle controller** (`world.createVehicleController`) on a chassis RigidBody — 4 wheels, front pair steered, rear pair driven (RWD). Gravity is `[0,-20,0]` (2× real). The file's top constants are the tuning surface (engine/brake forces, suspension, friction slip) and the comments there explain non-obvious choices: anisotropic inertia override (high pitch inertia to prevent wheelies/stoppies), soft speed cap via force attenuation, moderate grip to prevent roll-overs, and a chassis collider deliberately kept above the wheels' contact patch. **The car faces −Z**; the GLB model (`/public/models/car-1.glb`) is rotated `Math.PI` to match, and `FORWARD_SIGN` exists to flip drive direction if the wheel setup changes. Camera is a speed-zooming follow-cam in the same `useFrame`, with a brief decaying "establishing" bias when entering a zone. A `BoxCar` procedural fallback renders while the GLB loads (`HAS_GLTF` flag).

Other components never touch the controller — they read `translation()`/`linvel()` off the chassis body from the store or a passed ref.

### Racing circuit & leaderboard flow

`src/data/track.js` is the **single source of truth** for circuit geometry: 9 checkpoints on a big wraparound loop, path widths, radii. The checkpoint coordinates were verified against every world hazard with clearance margins — checkpoint 5 looks redundant but is load-bearing for the curve shape (see comments there). `Circuit.jsx` builds the visual track procedurally (merged geometry, checkered borders) and runs the race: sequential checkpoint hits → lap time → `raceStorage.js` localStorage best (`circuitBestLapMsV2`) → on a new local best, sets `store.pendingLeaderboardSubmit` → `LapTimerHUD` prompts for a name and POSTs to `/api/leaderboard`.

**Versioning rule:** the Redis leaderboard key (`circuit-leaderboard-v2` in `api/leaderboard.js`) and the localStorage best-lap key (`circuitBestLapMsV2` in `raceStorage.js`) are bumped **together** whenever the track shape/length changes, so old times aren't compared against a different track.

### Backend (`api/` + Upstash Redis)

Three Vercel serverless functions, all following the same shape: `Redis.fromEnv()` constructed lazily inside the handler → returns **503** if env vars are missing, try/catch around everything.
- `api/leaderboard.js` — sorted set `circuit-leaderboard-v2`, keeps fastest 100, returns top 10. Light validation only (12-char name, time bounds), no real anti-cheat.
- `api/whispers.js` — list `whispers`, capped at 30 newest, 30-char messages with world x/z position.
- `api/visitors.js` — counter `total-visitors`, INCR'd once per browser (deduped client-side via localStorage).

`Redis.fromEnv()` accepts either `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_URL`/`KV_REST_API_TOKEN` — covering both naming schemes the Vercel/Upstash integration may inject. **These env vars must be set in the Vercel project for the leaderboard/comments/visitor counter to work in production**; without them every function 503s and the UI shows OFFLINE.

Client-side counterparts in `src/utils/*Api.js` resolve to `null` on ANY failure so the UI degrades gracefully (OFFLINE label, silent no-op) instead of erroring. Keep that contract.

### The "Comments" feature (internally: whispers)

Visitor-left messages placed at the car's position in the world. **User-facing copy says "comment"; all internal names remain "whisper"** (`Whispers.jsx`, `whisperApi.js`, `whisperStorage.js`, `/api/whispers`, store fields, Redis key). Do not rename the internals — the Redis key and localStorage key (`hasWhispered`) hold live production data. `Whispers.jsx` exports two components: `Whispers` (inside Canvas — markers + writes `__carPosition`) and `WhisperInput` (outside Canvas — the text box, opened with C). One comment per browser, enforced via localStorage only.

### Performance tiers (`src/hooks/usePerformance.js`)

Mobile UA → tier 0 immediately; otherwise ~90 frames of FPS measurement → tier 0/1/2. `TIER_CONFIG` drives tree/prop counts, DPR, fog distance, the physics timestep (1/30 on tier 0), and shadows (off on tier 0 / mobile; 1024/2048 map on tier 1/2). The shadow-casting key light in `Lights.jsx` follows the car with a tight ~120-unit ortho frustum so shadows stay sharp across the whole 400×400 world. WebGL context attributes (`antialias`, `powerPreference`) can't wait for the async tier, so they come from the synchronous mobile check at Canvas mount. There's a WebGL context-lost overlay wired in `App.jsx`.

### Other pieces

- `Scene.jsx` composes everything 3D inside `<Physics>`; `World`/`Trees`/`EnvironmentModels` are the static world (instanced/capped by tier), `Zones.jsx` fires store actions on proximity, `AchievementSystem` watches store state and toasts unlocks (persisted in localStorage `achievedIds`/`visitedZones`).
- `Bowling.jsx` — SW quadrant mini-game: the car pushes a big dynamic ball into 10 pins on a wooden lane flanked by fixed bumper rails, with a clickable in-world ↻ RESTART sign (R3F pointer events, works as tap on mobile). Pin/ball/spacing dimensions are folio-2025's actual `areas.glb` values scaled ~0.875 (its truck ≈ our car's size); pins deliberately tower over the car. Strike = all 10 pins tilted past ~60°, detected per-frame via each pin body's up-vector; writes `strikeCount` to the store.
- Track visuals (`Circuit.jsx` `TrackPath`/`StartFinish`): opaque asphalt ribbon, raised red/white kerbs + white dashed centerline (all baked into 2 merged vertex-colored draw calls), checkered start/finish strip and an overhead gantry aligned to the track tangent. Kerbs/dashes are visual only — no colliders.
- `src/audio.js` — Howler wrapper; shuffled playlist from `/public/sounds/bg*.mp3`, engine/brake/collision SFX, `toggleMusic()` for the M key and MusicPlayer UI.
- localStorage keys in use: `hasCountedVisit`, `hasWhispered`, `visitedZones`, `achievedIds`, `circuitBestLapMsV2`.

## Build & deployment specifics

- `vite.config.js` manually chunks three/rapier/fiber/react into separate bundles, and sets **COOP/COEP headers** for dev; `vercel.json` sets the same headers for production (required for Rapier WASM threading).
- Deployed on Vercel. The `api/` functions deploy from the repo root alongside the Vite static build — if `/api/leaderboard` 404s in production, the deployment didn't include the functions (e.g. deployed from `dist/` instead of the repo root, or a stale deploy predating `api/`); if it returns 503 `"... not configured"`, the Redis env vars are missing from the Vercel project.
- Note: `asit-portfolio.vercel.app` is **someone else's site** (a different Asit). This project's production URL is whatever the linked Vercel project serves — don't test against that domain.

## Known state / history (as of 2026-08-13)

Development arc (see git log for detail): start screen + zones/resume world → GLB car + map overlay + billboard slideshow → boost/NOS + mobile support → R3F error/WebGL fixes → major perf overhaul (tiers, instancing) → real raycast-vehicle physics → racing circuit + camera/lighting/achievements polish → big wraparound track, bowling, whispers (comments), visitor counter → typing-guard fix + whisper→comment UI rename → folio-scale bowling overhaul (big ball/pins, lane + bumpers, restart button) + realistic track (asphalt, kerbs, centerline, start/finish gantry).

- Known issue: production leaderboard/comments/visitor counter show OFFLINE until Upstash Redis env vars are configured on the Vercel project (see Backend section).
- `src/components/Vehicle 2.jsx` is an untracked stale duplicate of `Vehicle.jsx` (pre-physics-overhaul, imports `../controls` with wrong casing) — safe to delete, never imported.
- `README.md` is still the default Vite template plus a title line.
- `Minimap.jsx` is legacy (replaced by `MapOverlay.jsx`); `DevStats.jsx` exports an in-canvas and an out-of-canvas (`RendererInfoOverlay`) half — the same split pattern `Whispers.jsx` uses.
