# Orbital Theme — 3D Living-World UI for AirMG

**Date:** 2026-06-12
**Status:** Approved design
**Reference bar:** Wora_Work-grade polish (awwwards-level interactive 3D), achieved procedurally — space scenes read as shaders (atmosphere scattering, aurora, bloom), not authored models.

## Summary

A third selectable theme, `orbital`, that replaces the dashboard with an
interactive 3D solar system rendered in WebGPU (WebGL2 fallback). Health data
is visualized diegetically — the world *is* the chart. The two existing themes
(`dark`, `liquid-glass`) are untouched and remain the default experience.

## Decisions Made

- **Direction:** Diorama world (not garnish, not HUD-only). Art: sci-fi
  orbital system matching AirMG's teal-on-dark identity. No low-poly look —
  shader-driven realism with heavy post-processing.
- **Stack:** three.js `WebGPURenderer` + `@react-three/fiber` v9 + `drei` +
  `@react-three/postprocessing` + `maath`. TSL node materials compile to WGSL
  (WebGPU) and GLSL (WebGL2) automatically. **No WASM** — no natural job for
  it here; revisit only if physics is ever wanted.
- **Scope (v1 = option B):** Landing scene + three hero dioramas
  (Recovery, Sleep, Strain) at maximum polish; all other routes are
  holo-console panels over the live scene. Deferred to v2: Trends "orbit
  trails", Health Age "twin planet".
- **Data viz ideology:** game-native/diegetic over charts. Real charts survive
  only inside holo panels where precision matters (e.g. workout HR trace).

## Architecture

- `themeAtom`: `"dark" | "liquid-glass" | "orbital"` (jotai, localStorage).
  Settings page gains the third option.
- When orbital active, `Shell` renders `<OrbitalWorld>` instead of
  sidebar+outlet: one persistent R3F `<Canvas>` that never unmounts. Routes
  drive camera + overlay, not scene lifecycle.
- React-router keeps owning URLs (`/`, `/recovery`, `/sleep`, `/strain`,
  console routes). Deep links and back-button work; route changes trigger
  camera moves (interruptible ~1.2s dollies; cuts under
  `prefers-reduced-motion`).
- All new code in `frontend/src/orbital/` (scene, shaders, HUD). Lazy-loaded
  chunk — other themes pay zero bytes. Existing pages/components unmodified.
- Data: existing jotai/react-query atoms reused, zero new endpoints. One new
  derived `worldStateAtom`: metrics → visual parameters.

## The Living World

Single solar system: star, planet (center), moon, one satellite, 3-layer
parallax starfield, polar aurora curtains, night-side city-light mosaic.

Every visual property is a pure function of data, tweened (1.5–2.5s springs,
never snapped). Date navigation re-simulates the entire frame to that day.
Hovering a HUD stat pulses its world object; react-query refetch drifts the
world to the new state.

| Signal | World response |
|---|---|
| Recovery % | Atmosphere thickness+hue (thin grey → deep teal), surface color saturation (lush ↔ ashen), storm-cell count |
| HRV vs baseline (z) | Aurora intensity/height; teal → violet below baseline |
| RHR vs baseline | Planet rotation speed (subtle) |
| Today's strain | Star corona scale + flare frequency |
| Sleep performance | Night-side city lights steady ↔ flickering |
| Sleep minutes vs need | Moon phase fullness |
| Steps | Satellite orbit speed |
| Sync staleness | HUD shimmer, slight world desaturation |
| No data (day or fresh user) | "Dormant" world: grey planet, no aurora; HUD prompt to sync |

## Scenes

- **Landing (`/`)** — full system view. Clickable: planet → `/recovery`,
  moon → `/sleep`, star → `/strain` (hover = glow+scale+label chip). HUD: recovery, strain, sleep summary panels with
  count-up numbers; bottom dock (slim glass pill) links console routes +
  "return to orbit" appears on all non-landing views (Esc works too).
- **Recovery (`/recovery`)** — dolly to planet. Four orbital baseline rings
  (HRV, RHR, resp, sleep perf); today's value is a glowing marker above/below
  its ring. Recovery % as atmosphere readout panel.
- **Sleep (`/sleep`)** — night side. The hypnogram becomes a 3D descent
  trajectory through altitude bands (Awake high orbit → Deep at surface);
  cursor-scrubbable; wake events are thruster flashes; stage totals = glow
  residency per band. Dense stage data is decimated before rendering.
- **Strain (`/strain`)** — face the star. Corona shells = HR zone minutes
  (zone 5 innermost). 24h flare ring = workouts; flare height = workout
  strain; hover opens holo readout incl. HR trace chart.
- **Consoles (everything else)** — existing page components wrapped in
  `ConsolePanel`: docked glass surface over the live blurred scene. Styled
  via a `.orbital` CSS theme class on the existing CSS-variable system (same
  mechanism as liquid-glass) — no per-page rewrites.

## Polish Contract

- Atmosphere: Fresnel rim-scattering shader (not a glow sprite), moving
  day/night terminator.
- Aurora: layered-noise vertical ribbon shader.
- Post stack: HDR bloom, filmic tonemapping, vignette, fine film grain,
  subtle edge chromatic aberration.
- Motion: slow planet rotation, parallax stars, mouse-eased camera with
  spring physics, cinematic dolly transitions, hover micro-interactions with
  high-grade easing, HUD numbers count up.
- First load: black → starfield fade (~1s) while chunk loads.

## Performance

- 60fps target (M-series/discrete), 30fps floor older iGPU with
  auto-degrade: post effects off first, then DPR→1. DPR capped at 2.
- Draw calls < 100; starfield instanced; scene pauses when `document.hidden`.
- WebGPU first; WebGL2 fallback automatic via TSL (post stack may differ
  slightly on fallback — accepted).

## Accessibility

- `prefers-reduced-motion`: camera cuts, near-zero idle amplitude.
- Invisible DOM buttons with aria-labels mirror all clickable world objects.
- HUD is real DOM (screen-reader readable).

## Testing

- `worldStateAtom` mapping: real unit tests (data → visual params contract).
- Scenes: Playwright screenshots against canned fixtures (great / average /
  depleted world-states), judged during dev rounds.
- One Playwright flow clicking through every camera destination + back.

## Risks

1. **Polish bar is an art bar.** Majority of effort is shader/easing tuning
   judged via screenshots with the user; plan for multiple refine rounds.
2. WebGPU flaky on some Linux/older Safari — fallback covers; minor visual
   differences accepted.
3. Descent-track scrubbing needs stage-data decimation (planned).
4. Pre-existing 8 TS build errors will pollute `tsc` output during this work —
   fix as hygiene early in implementation.

## Out of Scope (v2 backlog)

- Trends "orbit trails" spiral timeline; year-mosaic city lights.
- Health Age "twin planet" with habit tethers.
- Sound design.
- WASM physics (only if draggable/momentum interactions are wanted).
