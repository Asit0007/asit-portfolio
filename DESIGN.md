# DESIGN.md — Design language for asit-portfolio

Extracted from the actual source of [folio-2025](https://github.com/brunosimon/folio-2025) (Bruno Simon's portfolio, MIT-licensed code), which this project is modeled on. This is the reference for **every future visual/UI/motion/audio decision** in this repo. Use the *system* (tokens, scales, rules) — not Bruno's identity (his logo, brand assets, exact world). Where this project already deliberately diverges (desert-amber instead of folio's night-aubergine), the "ours" column is the canonical value.

## 1. Core aesthetic

Playful, warm, toy-like. The world is a low-poly diorama with flat stylized colors — **never photoreal PBR**. UI is rounded, generous, and friendly. Everything the visitor can do is physical and in-world first (drive into it, bump it, roll over it); 2D UI exists only for reading and typing. The game never pauses or takes control away from the driver.

## 2. Color tokens

### UI shell (folio's values → ours)

| Token | folio-2025 | ours (current) | Use |
|---|---|---|---|
| `bg-deep` | `#1d1721` | `#0d0500` | page/canvas background, loading screen |
| `bg-elevated` | `#251f2b` | `rgba(8,4,0,0.75–0.85)` + blur | HUD panels, overlays |
| `text-primary` | `#ffffff` | `rgba(255,255,255,0.85)` | body text |
| `text-emphasis` | `#ffceca` (soft pink) | `#ffe0a0` / `#f0c060` (amber) | labels, highlighted values, panel accents |
| `success` | `#d5ff95` (lime) | `#10b981` | achieved/unlocked, positive states |
| `accent-hot` | `#ff6a7c` / `#ff87a2` | `#c4154a` | celebration (STRIKE!), warnings, bowling |
| `alert` | `#C21515` | `#f43f5e` | errors, notifications |
| `accent-warm` | `#ffc67b` | `#f59e0b` | secondary warm accent |
| `speed/tech` | — | `#00d4ff` | live timer, NOS/boost (our addition — keep it only for speed-related UI) |

Rule: dark warm panel + one emphasis color + white. Never more than two accent colors in a single panel. Scrims/fades use `bg-deep` with alpha (folio: `#1D172100 → #1D172199` gradients), not black.

### World / 3D

| Token | folio-2025 | ours | Use |
|---|---|---|---|
| ground-high | `#ffcf8b` | desert sand tones | sunlit ground |
| ground-low | `#a87762` | — | ground shadow/valley tint |
| world-hot | `#ff8641`, `#ff3e00` | `#f0a050` fog, amber lights | sunset warmth, emissives |

World objects get **flat colors per mesh** (or per-vertex colors baked into merged geometry — see `Circuit.jsx`), moderate-to-high roughness, near-zero metalness. Emissive is reserved for things that should read at night/distance: headlights, gates, signs, celebration text.

## 3. Typography

folio-2025 uses three faces, all round and friendly:
- **Pally** (400/500/700, Fontshare) — headings/display
- **Nunito** (Google Fonts) — body UI
- **Amatic SC** 700 (Google Fonts) — oversized playful in-game buttons (48–64px)

Ours currently uses `monospace` everywhere — that's this portfolio's "terminal/infra engineer" identity and stays for HUD/data (timers, coordinates, boot screen). If/when adopting folio's warmth for content-heavy panels (zone overlays, achievements menu), adopt the *structure*:

- Root font size **20px**, stepping to 18px @ ≤520px and 16px @ ≤440px; size everything in `rem`/`em` or `clamp()` (we already use `clamp()` — keep it).
- Big, unapologetic display sizes for playful moments (folio's 64px buttons; our STRIKE! text).
- Letter-spacing for small uppercase labels: 0.1–0.22em (already our convention — keep).
- Weight scale: 400 body, 700 emphasis, 900 display.

## 4. Surfaces & components

Recipes (folio pattern → how it looks here):

- **HUD panel**: dark warm translucent bg + `backdrop-filter: blur(10–14px)` + 1px border in emphasis-color at ~18–35% alpha + border-radius 10–12px (pill 99px for single-line bars). Already our house style — all new panels must follow it.
- **Buttons**: no default chrome (folio resets button/input entirely); tinted bg (emphasis color @ ~18% alpha), 1px border @ ~40% alpha, emphasis-color text, disabled = opacity 0.5. Hover: raise emissive/brightness, never change size except playful `back.out` pops.
- **Touch targets**: minimum ~44px; folio's in-game buttons are 80px tall with 7vw padding — mobile controls should be generous (our steering wheel and pedals comply).
- **Gradient scrim** behind bottom-of-screen touch UI so it reads over any world color.
- **In-world text** (drei `<Text>`): always `outlineWidth` 0.02–0.09 with dark outline so it survives any background; white or emphasis color.
- **Interactive points** (folio's Restart, jukebox, etc. → our ↻ RESTART sign): a physical object in the world, revealed/emphasized contextually, clickable/tappable, with hover feedback (cursor + emissive).

## 5. Motion

folio-2025's gsap vocabulary (measured from source — durations cluster hard):

| Tier | Duration | Ease | Use |
|---|---|---|---|
| micro | **0.3s** | `power2.out` | hover states, small reveals |
| standard | **0.5–0.6s** | `power2.inOut` | panels in/out, HUD changes |
| cinematic | **1–2s** | `power2.inOut` / `power2.in` | camera moves, zone establishing shots, intro |
| playful pop | 0.4–0.6s | **`back.out(2)`** | achievement toasts, celebration elements |

For per-frame 3D animation we use exponential lerp (`1 - Math.exp(-k * dt)`) — the frame-rate-independent equivalent; keep that for camera/steering. Decay-based one-shots (zone camera bias) over state machines wherever possible.

## 6. Lighting & shading (3D)

folio-2025 uses a custom toon-ish model, not physical lighting: a single sun direction, **smoothstepped core shadow** (hard-ish terminator), shadows are the base color **multiplied by a warm shadow color** (never gray/black), plus a subtle upward "light bounce" tint from the ground. Practical translation for our R3F/standard-material world:

- One directional key light + warm ambient; shadow tint should stay warm (never neutral gray).
- Fog is a *color statement*, not just distance culling — ours is sunset `#f0a050`; any new fog/sky work stays in that warm band.
- Prefer baked/flat color contrast over adding lights. Light count is a perf budget (see TIER_CONFIG).

## 7. Sound

folio's rules (from its audio register): every physical interaction has a sound; volume/rate scale with **physics force** (collision speed → louder, slightly lower pitch); positional with distance fade; anti-spam windows so rapid hits don't machine-gun (we do this via `lastBrake`/`lastCollide` timestamps). Music is a shuffled playlist, user-toggleable, never autoplays before a user gesture.

## 8. UX principles (the non-negotiables)

1. **Driving is never interrupted.** No modal takes over while the car can move; zone overlays are passive; camera biases decay on their own.
2. **Everything degrades gracefully offline.** Server-backed features show a quiet `OFFLINE` / silent no-op state (null-returning API utils), never an error.
3. **Typing is sacred.** When any text field is focused, all game keys are dead (guards in `App.jsx` + `Vehicle.jsx`).
4. **Mobile is first-class**: every keyboard affordance needs a touch equivalent (R-reset → tappable RESTART sign; keys → steering wheel + gas/brake pedals + boost).
5. **Reward exploration**: achievements, easter eggs, celebration moments (STRIKE!, NEW BEST) are loud and joyful — `back.out` energy, hot accent colors, screen shake (`cameraShake.js`, keep ≤0.3 intensity).
6. **Performance is a design constraint**: new world visuals must state their draw-call cost; prefer merged/instanced geometry (2-draw-call track is the exemplar); respect `TIER_CONFIG` caps.

## 9. Don'ts

- No photoreal textures, no neutral-gray shadows, no pure-black UI.
- No cool/blue UI panels (except the reserved `#00d4ff` speed accent).
- No un-outlined in-world text; no borderless UI panels.
- No new fonts without updating this file; no more than 3 typefaces total.
- No feature that requires the server to be up; no feature that pauses driving.
- Don't copy folio-2025's brand/identity or assets — its *system* is the reference, this portfolio's desert-amber terminal identity is the skin.
