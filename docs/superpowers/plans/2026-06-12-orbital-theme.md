# Orbital Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third selectable theme, `orbital` — an interactive 3D solar system (WebGPU, WebGL2 fallback) where health metrics drive the world's visuals diegetically — without touching the existing `dark`/`liquid-glass` themes.

**Architecture:** One persistent react-three-fiber `<Canvas>` rendered by `Shell` when the theme is `orbital`; react-router keeps owning URLs and routes drive camera moves + DOM HUD overlays. A derived jotai atom (`worldStateAtom`) is the single contract mapping metric data → visual parameters; every scene object reads from it and tweens toward targets. All new code lives in `frontend/src/orbital/`, lazy-loaded so other themes pay zero bytes.

**Tech Stack:** three (WebGPURenderer + TSL node materials, WebGL backend fallback via the same renderer), `@react-three/fiber` v9, `@react-three/drei`, `maath`, three's native `PostProcessing` + TSL display nodes for bloom/grain/vignette (NOT pmndrs `@react-three/postprocessing` — WebGL-only, incompatible with WebGPURenderer). Vitest for the worldState unit tests.

**Spec:** `docs/superpowers/specs/2026-06-12-orbital-theme-design.md`

**API verification note:** TSL and WebGPURenderer APIs move fast. Before Tasks 5–9, open the installed `node_modules/three/examples/` equivalents (`webgpu_postprocessing_bloom`, `webgpu_tsl_*`) and verify import paths/signatures against the installed version. Do not trust memory for TSL specifics.

---

## File Structure

```
frontend/src/orbital/
  index.tsx                 — lazy entry: <OrbitalWorld/> (Canvas + routes + HUD)
  worldState.ts             — worldStateAtom: metrics → visual params (pure, tested)
  cameraRig.tsx             — route → camera target spring rig
  scene/
    Starfield.tsx           — instanced points, 3 parallax layers
    Planet.tsx              — surface + terminator + city lights (TSL material)
    Atmosphere.tsx          — fresnel scattering shell
    Aurora.tsx              — noise ribbon curtains
    Star.tsx                — sun + corona shells + flare ring
    MoonSat.tsx             — moon (phase) + satellite (orbit speed)
    Effects.tsx             — PostProcessing: bloom, tonemap, vignette, grain, CA
  hud/
    HudPanel.tsx            — glass panel primitive + CountUp number
    LandingHud.tsx          — landing overlays + bottom dock + a11y mirrors
    RecoveryRings.tsx       — baseline rings overlay readouts
    SleepDescent.tsx        — descent-track scene piece + scrub readout
    StrainFlares.tsx        — flare ring readouts + holo HR chart panel
    ConsolePanel.tsx        — wrapper docking existing pages over the scene
  orbital.css               — .orbital theme variables + console skin
frontend/src/atoms/theme.ts — add "orbital"
frontend/src/components/layout/Shell.tsx — branch on theme
frontend/src/pages/Settings.tsx — third theme card
frontend/vitest.config.ts, frontend/src/orbital/worldState.test.ts
```

---

### Task 1: Fix pre-existing TS build errors (hygiene gate)

`tsc -b` must be clean so every later task can use it as a check.

**Files:**
- Modify: `frontend/src/atoms/api.ts` (line ~12: remove `SleepSession` from the type-import list)
- Modify: `frontend/src/components/ui/scroll-area.tsx` (line 4: delete `import * as React from "react"` if unused — check first; if JSX needs it the project uses react-jsx transform, so it is removable)
- Modify: `frontend/src/pages/Journal.tsx` (line 2: drop unused `useSetAtom`; line ~79: `JournalQuestion` is not exported from atoms — export it from `frontend/src/atoms/api.ts` (`export interface JournalQuestion`) and import it in Journal.tsx)
- Modify: `frontend/src/pages/Today.tsx` (line ~21: delete the unused `greetingWord` function)
- Modify: `frontend/src/components/charts/HRChart.tsx` (line ~78) and `frontend/src/components/charts/TrendLine.tsx` (lines ~105-106): recharts formatter types — change callbacks to accept recharts' loose types and coerce:

```tsx
// HRChart.tsx tooltip formatter
formatter={(val) => [`${Math.round(Number(val))} bpm`, "HR"]}
// TrendLine.tsx
labelFormatter={(day) => String(day)}
formatter={(val) => [`${Number(val)}`, metricLabel]}
```

(Adapt to the existing return shapes — keep displayed strings identical; only widen parameter types.)

- [ ] **Step 1:** Apply the six fixes above.
- [ ] **Step 2:** Run `cd frontend && npx tsc -b` → expect zero errors.
- [ ] **Step 3:** Run `npx vite build` → expect success.
- [ ] **Step 4:** Commit: `git add -A frontend/src && git commit -m "fix: clear pre-existing TS build errors"`

### Task 2: Dependencies + vitest

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`

- [ ] **Step 1:** `cd frontend && npm i three @react-three/fiber@^9 @react-three/drei maath && npm i -D @types/three vitest`
- [ ] **Step 2:** Create `frontend/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["src/**/*.test.ts"] } });
```

- [ ] **Step 3:** Add to package.json scripts: `"test": "vitest run"`.
- [ ] **Step 4:** `npx vitest run` → "no test files found" exit 0 (passWithNoTests: add `passWithNoTests: true` to config).
- [ ] **Step 5:** Commit: `chore: add three/r3f/drei/maath + vitest`

### Task 3: worldStateAtom — the data→visual contract (TDD)

**Files:**
- Create: `frontend/src/orbital/worldState.ts`
- Test: `frontend/src/orbital/worldState.test.ts`

The pure function is the testable unit; the atom wraps it.

- [ ] **Step 1: Write failing tests**

```ts
// worldState.test.ts
import { describe, expect, it } from "vitest";
import { computeWorldState, DORMANT } from "./worldState";

const base = {
  recovery: 70, strainToday: 10, hrvZ: 0.5, rhrDelta: -2,
  sleepPerf: 85, sleepMinutes: 450, sleepNeedMinutes: 480,
  steps: 9000, syncStale: false, hasData: true,
};

describe("computeWorldState", () => {
  it("dormant when no data", () => {
    expect(computeWorldState({ ...base, hasData: false })).toEqual(DORMANT);
  });
  it("recovery drives atmosphere and surface", () => {
    const good = computeWorldState({ ...base, recovery: 95 });
    const bad = computeWorldState({ ...base, recovery: 10 });
    expect(good.atmosphereDensity).toBeGreaterThan(bad.atmosphereDensity);
    expect(good.surfaceSaturation).toBeGreaterThan(bad.surfaceSaturation);
    expect(bad.stormCount).toBeGreaterThan(good.stormCount);
  });
  it("hrv z drives aurora, clamped 0..1", () => {
    expect(computeWorldState({ ...base, hrvZ: 3 }).auroraIntensity).toBe(1);
    expect(computeWorldState({ ...base, hrvZ: -3 }).auroraIntensity).toBe(0);
    expect(computeWorldState({ ...base, hrvZ: -1 }).auroraVioletShift).toBeGreaterThan(
      computeWorldState({ ...base, hrvZ: 1 }).auroraVioletShift,
    );
  });
  it("strain drives corona 0..1 over 0..21", () => {
    expect(computeWorldState({ ...base, strainToday: 21 }).coronaActivity).toBe(1);
    expect(computeWorldState({ ...base, strainToday: 0 }).coronaActivity).toBe(0);
  });
  it("moon phase = sleep minutes vs need, clamped", () => {
    expect(computeWorldState({ ...base, sleepMinutes: 480 }).moonPhase).toBe(1);
    expect(computeWorldState({ ...base, sleepMinutes: 240 }).moonPhase).toBeCloseTo(0.5);
  });
  it("null metrics fall back to neutral, not NaN", () => {
    const s = computeWorldState({ ...base, recovery: null, hrvZ: null, strainToday: null });
    for (const v of Object.values(s)) expect(Number.isNaN(v as number)).toBe(false);
  });
});
```

- [ ] **Step 2:** `npx vitest run` → FAIL (module not found).
- [ ] **Step 3: Implement**

```ts
// worldState.ts
import { atom } from "jotai";
import {
  todayMetricsAtom, baselinesAtom, controlCenterDayAtom,
} from "../atoms/api";

export interface WorldInputs {
  recovery: number | null; strainToday: number | null; hrvZ: number | null;
  rhrDelta: number | null; sleepPerf: number | null;
  sleepMinutes: number | null; sleepNeedMinutes: number;
  steps: number | null; syncStale: boolean; hasData: boolean;
}

export interface WorldState {
  atmosphereDensity: number;   // 0..1
  atmosphereHue: number;       // 0 grey-blue .. 1 deep teal
  surfaceSaturation: number;   // 0 ashen .. 1 lush
  stormCount: number;          // integer 0..6
  auroraIntensity: number;     // 0..1
  auroraVioletShift: number;   // 0 teal .. 1 violet
  rotationSpeed: number;       // rad/s, subtle range
  coronaActivity: number;      // 0..1
  cityCalm: number;            // 0 flicker .. 1 steady
  moonPhase: number;           // 0 new .. 1 full
  satelliteSpeed: number;      // rad/s
  desaturate: number;          // 0..0.3 sync-stale wash
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const nz = (v: number | null, fallback: number) => (v == null ? fallback : v);

export const DORMANT: WorldState = {
  atmosphereDensity: 0.15, atmosphereHue: 0, surfaceSaturation: 0.05,
  stormCount: 0, auroraIntensity: 0, auroraVioletShift: 0,
  rotationSpeed: 0.01, coronaActivity: 0.05, cityCalm: 0.2,
  moonPhase: 0.3, satelliteSpeed: 0.05, desaturate: 0.3,
};

export function computeWorldState(i: WorldInputs): WorldState {
  if (!i.hasData) return DORMANT;
  const rec = clamp01(nz(i.recovery, 50) / 100);
  const hrvZ = nz(i.hrvZ, 0);
  return {
    atmosphereDensity: 0.25 + 0.75 * rec,
    atmosphereHue: rec,
    surfaceSaturation: 0.1 + 0.9 * rec,
    stormCount: Math.round(6 * clamp01((40 - nz(i.recovery, 50)) / 40)),
    auroraIntensity: clamp01(0.5 + hrvZ * 0.35),
    auroraVioletShift: clamp01(0.5 - hrvZ * 0.5),
    rotationSpeed: 0.01 + 0.02 * clamp01(nz(i.rhrDelta, 0) / 8 + 0.5),
    coronaActivity: clamp01(nz(i.strainToday, 0) / 21),
    cityCalm: clamp01(nz(i.sleepPerf, 50) / 100),
    moonPhase: clamp01(nz(i.sleepMinutes, 0) / i.sleepNeedMinutes),
    satelliteSpeed: 0.05 + 0.25 * clamp01(nz(i.steps, 0) / 10000),
    desaturate: i.syncStale ? 0.3 : 0,
  };
}

// Atom layer: derive inputs from existing data atoms (no new endpoints).
export const worldStateAtom = atom<WorldState>((get) => {
  const today = get(todayMetricsAtom);
  const baselines = get(baselinesAtom);
  const d = today.data as Record<string, number | null> | undefined;
  const hasData = !!d && !("status" in (d as object) && (d as { status?: string }).status === "no_data");
  const b = baselines.data?.baselines ?? (baselines.data as Record<string, { mean: number; spread: number }> | undefined);
  const hrv = d?.hrv_rmssd ?? null;
  const hb = b?.hrv;
  const hrvZ = hrv != null && hb ? (hrv - hb.mean) / Math.max(1.253 * hb.spread, 1e-9) : null;
  const rb = b?.resting_hr;
  const rhrDelta = d?.resting_hr != null && rb ? d.resting_hr - rb.mean : null;
  return computeWorldState({
    recovery: d?.recovery ?? null,
    strainToday: d?.strain ?? null,
    hrvZ,
    rhrDelta,
    sleepPerf: d?.sleep_performance ?? null,
    sleepMinutes: d?.sleep_minutes ?? null,
    sleepNeedMinutes: 480,
    steps: d?.steps ?? null,
    syncStale: false,
    hasData,
  });
});
export const worldDayAtom = controlCenterDayAtom; // date-nav = time travel
```

(Verify `baselinesAtom` response shape against `/api/baselines` — it returns `{metric: {mean, spread, status}}` flat; adjust accessor accordingly.)

- [ ] **Step 4:** `npx vitest run` → PASS.
- [ ] **Step 5:** Commit: `feat(orbital): worldState contract with tests`

### Task 4: Theme plumbing — atom, Settings, Shell branch, lazy chunk

**Files:**
- Modify: `frontend/src/atoms/theme.ts`
- Modify: `frontend/src/pages/Settings.tsx` (THEMES array)
- Modify: `frontend/src/components/layout/Shell.tsx`
- Create: `frontend/src/orbital/index.tsx` (placeholder Canvas this task)
- Create: `frontend/src/orbital/orbital.css`

- [ ] **Step 1:** `theme.ts`: `export type Theme = "dark" | "liquid-glass" | "orbital";`
- [ ] **Step 2:** Settings THEMES array: add `{ value: "orbital", label: "Orbital", desc: "Living 3D world (WebGPU)" }`.
- [ ] **Step 3:** Shell: when `theme === "orbital"` render lazy world instead of sidebar+outlet, keep router mounted:

```tsx
const OrbitalWorld = lazy(() => import("../../orbital"));
// in Shell render:
if (theme === "orbital") {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-black" />}> 
      <OrbitalWorld />
    </Suspense>
  );
}
```

- [ ] **Step 4:** `orbital/index.tsx` placeholder: full-screen `<Canvas>` with black background + one temp mesh + `<Outlet/>`-driven HUD shell (routes resolved via `useLocation`); import `./orbital.css`. Default export.
- [ ] **Step 5:** `npx tsc -b && npx vite build` → clean; switch theme in running app → black canvas renders, Settings still reachable? NOTE: with no sidebar, navigate by URL until Task 10's dock exists — acceptable mid-build.
- [ ] **Step 6:** Commit: `feat(orbital): theme option + lazy world shell`

### Task 5: Renderer + Starfield + Effects scaffold

**Files:**
- Modify: `frontend/src/orbital/index.tsx`
- Create: `frontend/src/orbital/scene/Starfield.tsx`
- Create: `frontend/src/orbital/scene/Effects.tsx`

- [ ] **Step 1:** Verify against installed three examples: `node_modules/three/examples/` → `webgpu_postprocessing_bloom.html` for `PostProcessing` + `pass()` + `bloom()` imports, and r3f v9 docs for async `gl` factory.
- [ ] **Step 2:** WebGPU renderer factory in index.tsx:

```tsx
import { Canvas } from "@react-three/fiber";
import * as THREE from "three/webgpu";

<Canvas
  dpr={[1, 2]}
  gl={async (props) => {
    const renderer = new THREE.WebGPURenderer({ ...props as object, antialias: true });
    await renderer.init();
    return renderer;
  }}
>
```

(WebGPURenderer auto-falls back to its WebGL backend where WebGPU is unavailable.)

- [ ] **Step 3:** Starfield: 3 instanced point layers (counts 3000/1500/600, radii 400/250/150), sizes 0.6–1.6, slight hue variance, each layer rotates at different rate for parallax; `frustumCulled={false}`.
- [ ] **Step 4:** Effects.tsx: three-native post chain (bloom strength ~0.6 threshold ~0.8, filmic tonemap, vignette, film grain ~0.035, edge CA ~0.0015) using TSL display nodes per the verified example. Mount inside Canvas; expose `quality: "high" | "low"` prop (low = skip everything but tonemap).
- [ ] **Step 5:** Visual check via Playwright screenshot: starfield + bloom visible, 60fps in devtools.
- [ ] **Step 6:** Commit: `feat(orbital): renderer, starfield, post stack`

### Task 6: Planet — surface, terminator, city lights

**Files:**
- Create: `frontend/src/orbital/scene/Planet.tsx`

- [ ] **Step 1:** TSL node material on a 64-seg sphere (radius 2): fbm noise (4 octaves, `mx_noise_float` or hand-rolled) → continents/ocean mix; `surfaceSaturation` uniform lerps lush↔ashen palette; lighting from star direction uniform; terminator = smoothstep on NdotL; night side: second noise threshold = city-light dots, brightness × `cityCalm`, flicker = time-noise × (1−cityCalm); `desaturate` uniform mixes toward grey.
- [ ] **Step 2:** Drive uniforms from `worldStateAtom` with `useFrame` + `maath/easing.damp` (≈2s) — never set targets directly.
- [ ] **Step 3:** Rotation: `rotationSpeed` from state, damped.
- [ ] **Step 4:** Storm cells: `stormCount` instanced swirl sprites (small noise-textured quads) on surface lat band, additive, spin slowly.
- [ ] **Step 5:** Screenshot at recovery fixtures 95 / 50 / 10 (mock atom via dev override query param `?worldFixture=great|avg|bad` handled in worldState read) — verify visible lush→ashen + storm delta.
- [ ] **Step 6:** Commit: `feat(orbital): living planet`

### Task 7: Atmosphere + Aurora

**Files:**
- Create: `frontend/src/orbital/scene/Atmosphere.tsx`
- Create: `frontend/src/orbital/scene/Aurora.tsx`

- [ ] **Step 1:** Atmosphere: backside sphere shell (radius ×1.06), TSL fresnel `pow(1 - dot(viewDir, normal), 3.5)` × density uniform; color lerp grey-blue→teal by `atmosphereHue`; additive blending; plus faint forward-scatter rim on day side.
- [ ] **Step 2:** Aurora: 3 curved ribbon planes near north pole; vertex wave (time + noise), fragment = vertical gradient × layered noise scroll; color mix teal→violet by `auroraVioletShift`; opacity × `auroraIntensity`; additive, depthWrite off.
- [ ] **Step 3:** Damp uniforms from worldState as in Task 6.
- [ ] **Step 4:** Screenshots: hrvZ +2 vs −2 fixtures → intensity + hue shift visible.
- [ ] **Step 5:** Commit: `feat(orbital): atmosphere scattering + aurora`

### Task 8: Star, corona, moon, satellite

**Files:**
- Create: `frontend/src/orbital/scene/Star.tsx`
- Create: `frontend/src/orbital/scene/MoonSat.tsx`

- [ ] **Step 1:** Star at SUN_POSITION (22, 5, −36): emissive sphere + 3 additive corona shells (noise-scrolled fresnel), shell scale/turbulence × `coronaActivity`; light source (directional) aimed at planet.
- [ ] **Step 2:** Flares (used fully in Task 13): instanced arc sprites on an equatorial ring, count/height from props — render 0 by default here.
- [ ] **Step 3:** Moon: sphere radius 0.5, orbit radius 4.5; phase = shader mask driven by `moonPhase` (terminator offset). Satellite: small box+panel group, orbit radius 3.2, angular speed = `satelliteSpeed`.
- [ ] **Step 4:** Screenshots: strain 0 vs 21 fixtures → corona delta obvious.
- [ ] **Step 5:** Commit: `feat(orbital): star system bodies`

### Task 9: Camera rig + route sync + clickable bodies + a11y

**Files:**
- Create: `frontend/src/orbital/cameraRig.tsx`
- Modify: `frontend/src/orbital/index.tsx`

- [ ] **Step 1:** Camera targets map:

```ts
const CAMERA_TARGETS: Record<string, { pos: [number,number,number]; look: [number,number,number] }> = {
  "/":         { pos: [0, 1.2, 9],   look: [0, 0, 0] },
  "/recovery": { pos: [0.5, 0.8, 4], look: [0, 0, 0] },
  "/sleep":    { pos: [-2.6, 0.6, 3.4], look: [-0.8, 0, 0] },   // night side
  "/strain":   { pos: [8, 2, -13],  look: [22, 5, -36] },   // derive from SUN_POSITION (moved in Task 8 so the sun frames on-screen)
};
const CONSOLE_TARGET = { pos: [0, 2.2, 11], look: [0, 0, 0] };  // pulled back, scene blurred behind panel
```

- [ ] **Step 2:** Rig: `useLocation()` → target; `useFrame` damps `camera.position` + a lookAt proxy with `maath/easing.damp3` (smoothTime ~0.45 → ≈1.2s settle); `prefers-reduced-motion` (via `matchMedia`) → snap instantly. Mouse parallax: ±0.15 offset, damped, disabled under reduced motion.
- [ ] **Step 3:** Click/hover: planet→`/recovery`, moon→`/sleep`, star→`/strain` via `onClick={() => navigate(...)}`; hover = damped scale 1.04 + emissive boost + `document.body.style.cursor`; floating label chip (drei `<Html>`).
- [ ] **Step 4:** a11y mirrors: visually-hidden DOM buttons ("View recovery planet", "View sleep moon", "View strain star") absolutely positioned in HUD layer, same navigate handlers. Esc key → navigate("/").
- [ ] **Step 5:** Playwright: click each body → URL changes, camera settles (assert via screenshot diff after 1.5s). Browser back retargets without remount (assert canvas DOM node identity via evaluate).
- [ ] **Step 6:** Commit: `feat(orbital): camera rig, navigation, a11y`

### Task 10: HUD primitives + landing HUD + dock

**Files:**
- Create: `frontend/src/orbital/hud/HudPanel.tsx`
- Create: `frontend/src/orbital/hud/LandingHud.tsx`
- Modify: `frontend/src/orbital/orbital.css`

- [ ] **Step 1:** `HudPanel`: glass panel (`backdrop-blur`, 1px teal hairline, inner top highlight, 14px radius) + `<CountUp value/>` (rAF 600ms ease-out, tabular-nums). Pure DOM, absolutely positioned over canvas.
- [ ] **Step 2:** `LandingHud`: top-left recovery panel (value + one-line world status string derived from worldState, e.g. "atmosphere stable · aurora active"), top-right strain + sleep mini-panels, top-center `DateNav` (reuse existing component — date atom already drives worldState), bottom legend line.
- [ ] **Step 3:** Bottom dock: slim glass pill, icon links (Workouts, Trends, Insights, Coach, Journal, Health Age, Settings) + "◉ Orbit" return button shown when not on `/`. NavLink-based.
- [ ] **Step 4:** Hover sync: panel hover → set `hoveredObjectAtom` → corresponding body pulses (read in scene components).
- [ ] **Step 5:** Screenshot review vs the approved mood mock (composition parity).
- [ ] **Step 6:** Commit: `feat(orbital): HUD layer + dock`

### Task 11: Console pages

**Files:**
- Create: `frontend/src/orbital/hud/ConsolePanel.tsx`
- Modify: `frontend/src/orbital/index.tsx` (route table)
- Modify: `frontend/src/orbital/orbital.css`

- [ ] **Step 1:** Route table inside OrbitalWorld: hero routes (`/`, `/recovery`, `/sleep`, `/strain`) → HUD scenes; all others render `<ConsolePanel><ExistingPage/></ConsolePanel>` (import the existing page components directly).
- [ ] **Step 2:** ConsolePanel: centered max-w-3xl glass surface, scene behind gets CSS `filter: blur(6px) brightness(0.6)` on the canvas wrapper while a console is open (CSS class toggle, transition 400ms); camera eases to CONSOLE_TARGET.
- [ ] **Step 3:** `.orbital` class on `<html>` (set by theme effect, same mechanism as `.dark`/`.liquid-glass` — check `frontend/src/main.tsx`/theme effect and replicate): define the CSS variable overrides (surfaces near-black blue, teal accent, hairlines `#2ee6a826`) so existing components inside consoles restyle for free.
- [ ] **Step 4:** Click through every console route; Settings works → can switch theme back (escape hatch verified).
- [ ] **Step 5:** Commit: `feat(orbital): console panels for non-hero routes`

### Task 12: Recovery diorama — baseline rings

**Files:**
- Create: `frontend/src/orbital/hud/RecoveryRings.tsx` (DOM readouts)
- Modify: `frontend/src/orbital/scene/Planet.tsx` (rings render when route is /recovery)

- [ ] **Step 1:** Rings: 4 `<torus>` (HRV, RHR, resp, sleep perf) radii 2.4/2.7/3.0/3.3, thin (0.012), hairline teal, 35° tilt. Today-markers: small glowing spheres positioned above/below ring plane by `clamp(z, -1.5, 1.5) × 0.25` where z = deviation vs baseline (reuse data path from `recoveryDetailAtom` + baselines).
- [ ] **Step 2:** Fade rings in only on `/recovery` (opacity damp by route match).
- [ ] **Step 3:** DOM: left panel = recovery % + band word; each ring hover (raycast) highlights + shows metric chip (value vs baseline ± spread).
- [ ] **Step 4:** Screenshot fixtures great/avg/bad; verify markers sit visibly above/below rings.
- [ ] **Step 5:** Commit: `feat(orbital): recovery baseline rings diorama`

### Task 13: Sleep diorama — descent track

**Files:**
- Create: `frontend/src/orbital/hud/SleepDescent.tsx` (scene piece + DOM readout co-located)

- [ ] **Step 1:** Data: `sleepDetailAtom` stages → decimate: merge consecutive same-stage segments, drop segments < 2 min (keep wake events as point markers). Map: time → angle along a 70° arc over the night side; stage → altitude band (wake 3.4, rem 3.0, light 2.6, deep 2.3 radius).
- [ ] **Step 2:** Track: `TubeGeometry` along a `CatmullRomCurve3` through band points, vertex-colored by stage (existing `sleepStageColor` palette), emissive; wake events = small flash sprites ("thruster burns").
- [ ] **Step 3:** Scrub: pointer-move raycast on an invisible widened tube → time marker sphere + DOM chip (clock time + stage). Mobile/no-hover: chip shows totals instead.
- [ ] **Step 4:** DOM panel: stage totals as band-residency bars (reuse minutes from session payload), sleep performance count-up.
- [ ] **Step 5:** Screenshot vs a real night fixture; verify hypnogram silhouette recognizable vs the 2D chart for the same data.
- [ ] **Step 6:** Commit: `feat(orbital): sleep descent track`

### Task 14: Strain diorama — corona shells + flare ring

**Files:**
- Create: `frontend/src/orbital/hud/StrainFlares.tsx`
- Modify: `frontend/src/orbital/scene/Star.tsx`

- [ ] **Step 1:** Corona shells scale with zone minutes (from `/api/workouts/summary` hr_zones — `workoutsSummaryAtom`): zone5 innermost…zone1 outer; shell opacity ∝ minutes share.
- [ ] **Step 2:** Flare ring: 24h ring around star; each workout = flare arc at its start-hour angle, height ∝ workout strain, color by intensity. Instanced arcs, additive.
- [ ] **Step 3:** Hover flare → holo panel: workout type, duration, calories, avg/max HR + small HR-trace line chart (existing recharts HRChart inside the glass panel — the agreed "charts where precision matters").
- [ ] **Step 4:** DOM: day strain count-up + zone-minutes legend.
- [ ] **Step 5:** Screenshots: strain 0 / 10 / 19 fixtures.
- [ ] **Step 6:** Commit: `feat(orbital): strain star diorama`

### Task 15: Performance degrade + visibility pause + reduced motion sweep

**Files:**
- Modify: `frontend/src/orbital/index.tsx`, `scene/Effects.tsx`

- [ ] **Step 1:** FPS monitor (rolling 120-frame avg in useFrame): < 45fps for 5s → set `qualityAtom` "low" (Effects minimal) → still < 30 → DPR 1. One-way ratchet per session.
- [ ] **Step 2:** `document.visibilitychange` → `frameloop: "never"` when hidden, `"always"` when visible (r3f `setFrameloop`).
- [ ] **Step 3:** Reduced-motion sweep: camera snaps (done Task 9), idle amplitudes × 0.1, aurora scroll × 0.2, count-ups instant.
- [ ] **Step 4:** Verify: throttle CPU 6× in devtools → degrade kicks in; tab hide → GPU idle in Activity Monitor.
- [ ] **Step 5:** Commit: `feat(orbital): perf degrade + pause + reduced motion`

### Task 16: End-to-end flow + polish rounds

**Files:**
- Create: `frontend/e2e-orbital.md` (manual checklist; Playwright is MCP-driven here, no test harness file)

- [ ] **Step 1:** Full Playwright pass: switch theme → landing → click planet/moon/star → each diorama renders data → console routes → back/Esc → return to orbit → switch theme back to dark (everything intact).
- [ ] **Step 2:** Screenshot set for the three fixtures × 4 scenes (12 shots) → present to user for the first polish round.
- [ ] **Step 3:** Polish rounds (expected: several): tune bloom/exposure, palette, easing curves, noise scales per user feedback. Each round = screenshots + diff. THIS IS THE MAJORITY OF THE BUDGET — do not rush.
- [ ] **Step 4:** `npx tsc -b && npx vite build && npx vitest run` all green; backend untouched (`uv run pytest` unchanged).
- [ ] **Step 5:** Final commit: `feat(orbital): polish pass N`

---

## Self-Review Notes

- Spec coverage: theme plumbing (T4), living-world mapping (T3/6/7/8), landing+nav+a11y (T9/10), consoles+skin (T11), three dioramas (T12-14), post/polish contract (T5/16), perf (T15), no-data dormant state (T3 DORMANT + fixture), date time-travel (DateNav reuse, T10), TS hygiene (T1). Deferred v2 items intentionally absent.
- Sync-staleness shimmer: covered by `desaturate` param (T3) wired in planet material (T6); HUD shimmer dropped as YAGNI for v1 — desaturation alone communicates it.
- Type consistency: `WorldState` field names used in Tasks 6-8 match Task 3 definitions; `qualityAtom` introduced T15, consumed only in Effects (T5 exposes `quality` prop).
- Placeholder scan: shader steps describe exact technique + uniforms but final constants are tuning targets by design (polish rounds T16) — acceptable, they are starting values, all given.
