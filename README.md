# asit-portfolio

An interactive 3D portfolio you **drive through**. Instead of scrolling a resume, you steer a car around a warm desert world where every landmark is a section of my CV — plus a racing circuit with a global leaderboard, a bowling mini-game, and comments left by other visitors, placed right where they wrote them.

Built by **Asit Minz** — Cloud & Infrastructure Engineer, Bangalore. Inspired by [Bruno Simon's folio](https://bruno-simon.com/) school of playable portfolios.

## Controls

| Input | Action |
|---|---|
| `WASD` / arrow keys | Drive |
| `Space` | Brake |
| `Shift` | NOS boost |
| `R` | Reset car |
| `C` | Leave a comment in the world |
| `Tab` | Toggle map |
| `M` | Toggle music |

Mobile gets a virtual joystick and boost button — every keyboard affordance has a touch equivalent.

## What's in the world

- **Resume zones** — drive into a zone (Experience, Projects, Contact, …) and its content appears without ever pausing the driving.
- **Racing circuit** — a 9-checkpoint wraparound track with lap timing and a global top-10 leaderboard.
- **Bowling** — push a giant ball into 10 towering pins; strikes are celebrated loudly.
- **Comments** — visitors can leave one message each, pinned to the spot where their car stood.
- **Live visitor counter** on an in-world billboard.

## Stack

- **React 18 + Vite** — app shell and build
- **Three.js** via **@react-three/fiber** + **drei** — 3D rendering
- **@react-three/rapier** (Rapier WASM) — raycast-vehicle physics, lazy-loaded so the start screen paints before the 2 MB physics bundle arrives
- **Zustand** — single state store bridging the 3D world and the 2D HUD
- **Howler** — music playlist + physics-driven sound effects
- **Vercel serverless functions + Upstash Redis** — leaderboard, comments, visitor counter (the UI degrades to a graceful OFFLINE state without them)

Performance is tiered at runtime: a quick FPS measurement picks low/medium/high presets for tree/prop counts, pixel ratio, fog distance, and physics timestep.

## Develop

```bash
npm install
npm run dev       # dev server at localhost:5173
npm run build     # production build → dist/
npm run preview   # preview the production build
npm run lint      # eslint over src/ and api/
```

Notes:

- COOP/COEP headers are required for Rapier's WASM threading — set in `vite.config.js` for dev and `vercel.json` for production.
- Without Upstash Redis credentials, the leaderboard/comments/visitor APIs return null and the UI shows OFFLINE — expected in local dev. To exercise the API routes locally, use `vercel dev` with `vercel env pull`.

## Deploy

Deployed on Vercel from the repo root (the `api/` serverless functions ship alongside the static build). The Redis-backed features need `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (or the `KV_REST_API_*` equivalents) set on the Vercel project.
