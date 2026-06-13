# Orbital Living Earth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the orbital theme's aurora speak recovery, turn the procedural planet into a real textured Earth, and light the whole scene from the user's real local clock (time-of-day).

**Architecture:** Three independent changes to the existing `frontend/src/orbital/` scene. (1) `worldState` exposes `recovery01`; `Aurora` colors itself from the recovery palette while keeping HRV-driven brightness. (2) `Planet` samples real NASA day/night textures and recovery *grades* them (sea mask derived in-shader from ocean blue-dominance — no extra asset). (3) A new pure `solarClock` module derives a sun direction + warmth from `new Date()`; `Planet` damps a `sunDir` uniform toward it so the terminator sits at local time, and rotation slows to a gentle drift. No new routes, no backend.

**Tech Stack:** three/webgpu + TSL node materials, `@react-three/fiber` v9, `maath/easing` (`damp`, `damp3`), jotai, Vitest. Visual validation via Playwright MCP screenshots using `?worldFixture=` × `?timeFixture=` query overrides.

**Spec:** `docs/superpowers/specs/2026-06-13-orbital-living-earth-design.md`
**Vision (context):** `docs/superpowers/specs/2026-06-13-orbital-data-city-vision.md`

**API verification note:** TSL APIs move fast. The exact node functions used here (`mix`, `clamp`, `color`, `uniform`, `smoothstep`, `texture`) already appear in the installed `scene/Planet.tsx` / `scene/Aurora.tsx` — match their import style from `three/tsl`. For texture sampling, verify `texture(tex, uvNode)` against the installed three version's TSL exports before Task 2 (open `scene/Planet.tsx` and any existing `texture(` usage; if none, check `node_modules/three` TSL d.ts for the `texture` node).

---

## File Structure

```
frontend/src/orbital/
  worldState.ts            — MODIFY: drop auroraVioletShift, add recovery01
  worldState.test.ts       — MODIFY: swap violetShift assertions for recovery01
  scene/Aurora.tsx         — MODIFY: recovery-palette color ramp; recovery01 uniform
  scene/Planet.tsx         — MODIFY: real Earth textures, recovery grade, sunDir + warmth uniforms, slow drift
  solarClock.ts            — CREATE: pure solar math + useSolarClock hook + fixture override
  solarClock.test.ts       — CREATE: unit tests for the pure math
  index.tsx                — MODIFY: call useSolarClock, pass sunDir/warmth to Planet
frontend/public/orbital/
  earth-day.jpg            — CREATE (asset): NASA Blue Marble albedo, 2048×1024
  earth-night.jpg          — CREATE (asset): NASA city lights, ~2048 wide
```

---

### Task 1: Aurora speaks recovery (worldState + Aurora)

worldState and Aurora change together so the build stays green in one commit. The pure logic (`recovery01`) is TDD'd; the shader color ramp is build- + visually-verified.

**Files:**
- Modify: `frontend/src/orbital/worldState.ts`
- Modify: `frontend/src/orbital/worldState.test.ts`
- Modify: `frontend/src/orbital/scene/Aurora.tsx`

- [ ] **Step 1: Update the failing tests first.** In `worldState.test.ts`, replace the `"hrv z drives aurora, clamped 0..1"` test body (it currently asserts `auroraVioletShift`) with intensity-only assertions, and add a new `recovery01` test:

```ts
	it("hrv z drives aurora intensity, clamped 0..1", () => {
		expect(computeWorldState({ ...base, hrvZ: 3 }).auroraIntensity).toBe(1);
		expect(computeWorldState({ ...base, hrvZ: -3 }).auroraIntensity).toBe(0);
	});
	it("recovery01 tracks recovery/100; null → neutral 0.5", () => {
		expect(computeWorldState({ ...base, recovery: 95 }).recovery01).toBeCloseTo(0.95);
		expect(computeWorldState({ ...base, recovery: 10 }).recovery01).toBeCloseTo(0.1);
		expect(computeWorldState({ ...base, recovery: null }).recovery01).toBeCloseTo(0.5);
	});
```

- [ ] **Step 2: Run the tests, expect failure.**

Run: `cd frontend && npx vitest run src/orbital/worldState.test.ts`
Expected: FAIL — `recovery01` is `undefined` / property does not exist on `WorldState`.

- [ ] **Step 3: Update `worldState.ts`.** In the `WorldState` interface, remove the `auroraVioletShift` line and add `recovery01`:

```ts
	auroraIntensity: number; // 0..1
	recovery01: number; // 0 depleted .. 1 peak — drives aurora hue
```

In `DORMANT`, remove `auroraVioletShift: 0,` and add `recovery01: 0,`.

In `computeWorldState`, remove the `auroraVioletShift: clamp01(0.5 - hrvZ * 0.5),` line and add (next to `auroraIntensity`):

```ts
		recovery01: clamp01(nz(i.recovery, 50) / 100),
```

- [ ] **Step 4: Run the tests, expect pass.**

Run: `cd frontend && npx vitest run src/orbital/worldState.test.ts`
Expected: PASS (all blocks, including the existing `dormant when no data` `toEqual(DORMANT)` test, which now compares the updated DORMANT shape).

- [ ] **Step 5: Update `Aurora.tsx` imports and uniforms.** Add `clamp` to the `three/tsl` import list. Replace `makeUniforms` (currently `intensity` + `violetShift`):

```ts
const makeUniforms = () => ({
  intensity: uniform(DORMANT.auroraIntensity),
  recovery01: uniform(DORMANT.recovery01),
});
```

- [ ] **Step 6: Add the recovery color ramp and rewire the color nodes.** Above `buildRibbonMaterial`, add the palette + ramp helper:

```ts
// 5-stop recovery palette (matches src/index.css --color-recovery-*)
const RECOVERY_STOPS = [
  color("#FF4F73"), // depleted
  color("#F5A623"), // low
  color("#E8C24B"), // moderate
  color("#18C98B"), // primed
  color("#2FE6A8"), // peak
];

/** Piecewise-linear lerp across the 5 stops, keyed on a 0..1 node. */
function recoveryRamp(t01: ReturnType<typeof uniform>) {
  const seg = t01.mul(4);
  const f = (lo: number) => clamp(seg.sub(lo), 0, 1);
  return mix(
    mix(mix(mix(RECOVERY_STOPS[0], RECOVERY_STOPS[1], f(0)), RECOVERY_STOPS[2], f(1)), RECOVERY_STOPS[3], f(2)),
    RECOVERY_STOPS[4],
    f(3),
  );
}
```

Inside `buildRibbonMaterial`, replace the three color lines (the `baseColor` / `tipColor` / `rgb` block) with:

```ts
  // hue follows recovery (red depleted -> mint peak); tip rides a touch brighter
  const baseColor = recoveryRamp(u.recovery01);
  const tipColor = baseColor.mul(1.18).add(vec3(0.02, 0.05, 0.07));
  const rgb = mix(baseColor, tipColor, smoothstep(0.3, 1.0, t).mul(0.65)).mul(1.8);
```

- [ ] **Step 7: Update the damp call in `useFrame`.** Replace the `violetShift` damp line:

```ts
    damp(uniforms.recovery01, "value", world.recovery01, 2.2, dt);
```

(Keep the `intensity` damp line above it unchanged.)

- [ ] **Step 8: Build + full test run.**

Run: `cd frontend && npx tsc -b && npx vitest run`
Expected: zero TS errors (no remaining `auroraVioletShift` references anywhere — grep to confirm: `grep -rn auroraVioletShift src` returns nothing), all tests pass.

- [ ] **Step 9: Commit.**

```bash
git add frontend/src/orbital/worldState.ts frontend/src/orbital/worldState.test.ts frontend/src/orbital/scene/Aurora.tsx
git commit -m "feat(orbital): aurora hue follows recovery, brightness stays HRV"
```

---

### Task 2: Real Earth textures + recovery grade

Swap the procedural surface for real NASA textures; recovery grades them; sea mask derived in-shader. `sunDir` becomes a uniform (defaulted so the look is unchanged until Task 4 wires the clock).

**Files:**
- Create (assets): `frontend/public/orbital/earth-day.jpg`, `frontend/public/orbital/earth-night.jpg`
- Modify: `frontend/src/orbital/scene/Planet.tsx`

- [ ] **Step 1: Fetch + downscale the two public-domain NASA textures.**

```bash
mkdir -p frontend/public/orbital
# Day albedo — NASA Blue Marble (public domain)
curl -L -o /tmp/earth-day-src.jpg "https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57752/land_ocean_ice_2048.jpg"
# Night city lights — NASA (public domain)
curl -L -o /tmp/earth-night-src.jpg "https://eoimages.gsfc.nasa.gov/images/imagerecords/55000/55167/earth_lights_lrg.jpg"
# Downscale to 2048 wide (macOS sips; or use ImageMagick `convert -resize 2048x`)
sips -Z 2048 /tmp/earth-day-src.jpg --out frontend/public/orbital/earth-day.jpg
sips -Z 2048 /tmp/earth-night-src.jpg --out frontend/public/orbital/earth-night.jpg
ls -lh frontend/public/orbital/
```

Expected: two `.jpg` files, each well under ~1.5 MB. If a URL 404s, substitute any equivalent NASA Blue Marble / Black Marble jpg (both are public domain) and keep the same filenames. These live in `public/` so Vite serves them at `/orbital/earth-day.jpg` at runtime (lazy — only the orbital chunk references them).

- [ ] **Step 2: Load the textures in `Planet.tsx`.** Add to the `three` / `three/tsl` imports as needed: `texture` from `three/tsl`. Inside the `Planet` component, before the `useMemo` that builds the material, load and memoize the textures (and dispose on unmount):

```ts
  const textures = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const day = loader.load("/orbital/earth-day.jpg");
    const night = loader.load("/orbital/earth-night.jpg");
    day.colorSpace = THREE.SRGBColorSpace;
    night.colorSpace = THREE.SRGBColorSpace;
    day.anisotropy = 4;
    return { day, night };
  }, []);
  useEffect(
    () => () => {
      textures.day.dispose();
      textures.night.dispose();
    },
    [textures],
  );
```

Pass `textures` into `buildSurfaceMaterial` (change its signature to `buildSurfaceMaterial(u, textures)` and the `useMemo` call site accordingly).

- [ ] **Step 3: Make `sunDir` a uniform.** In `makeUniforms`, add (defaulted to today's static direction so nothing changes yet):

```ts
  sunDir: uniform(SUN_DIR.clone()),
  warmth: uniform(1),
```

In `buildSurfaceMaterial`, replace `const sunDir = sunDirNode();` with `const sunDir = u.sunDir;`. (Leave `STORM_SLOTS` / `buildStorm` using the static `sunDirNode()` — storm day-side gating staying fixed is acceptable for v1.)

- [ ] **Step 4: Sample real albedo + derive the sea mask; keep the recovery grade.** Replace the procedural terrain/palette block (the fbm `warp`/`h`/`landMask`/`detail`/`depth`/`oceanLush`…`surface` section) with texture sampling and a blue-dominance sea mask:

```ts
  // -- real Earth albedo --
  const dayTex = texture(textures.day, uv()).rgb;
  // ocean reads bluer than land — cheap sea mask, no extra asset
  const sea = smoothstep(0.0, 0.08, dayTex.b.sub(dayTex.r.max(dayTex.g)));
  const land = oneMinus(sea);

  // recovery grade: vivid albedo when recovered -> desaturated + dimmed when depleted
  const lum = luminance(dayTex);
  const graded = mix(vec3(lum).mul(0.55), dayTex, u.saturation.pow(1.2).mul(0.85).add(0.15));
  const surface = graded;
```

(`landMask` is now `land`, `ice` is no longer computed separately — the day texture already contains polar ice. Remove the old `pole`/`ice` lines.)

- [ ] **Step 5: Keep lighting/terminator, repoint glint to the derived sea mask, add warmth.** In the lighting block, the `glint` line currently multiplies `oneMinus(landMask)` and `oneMinus(ice)` — replace those with `sea`:

```ts
  const glint = clamp(specDir.dot(viewDir), 0, 1)
    .pow(64)
    .mul(sea)
    .mul(day)
    .mul(fresnel.mul(2.2).add(0.3));
```

In the `lit` composition, warm the day term by `warmth` (warm/dim at low warmth → neutral bright near noon):

```ts
  const dayWarm = mix(color("#ff9a5c"), color("#ffffff"), u.warmth);
  const lit = surface
    .mul(dayWarm)
    .mul(day.mul(u.warmth.mul(0.9).add(0.6)).add(0.018))
    .add(surface.mul(color("#33446e")).mul(oneMinus(day)).mul(0.32))
    .add(color("#ff9a5c").mul(duskBand).mul(0.022))
    .add(color("#e2f4ff").mul(glint).mul(0.85));
```

- [ ] **Step 6: Night lights from the real texture.** Replace the procedural `clusters`/`dots`/`cityMask` block. Keep the existing `night`, `flicker`, `flickAmp`, `cityBrightness` logic but drive the mask from the night texture (gated to land + night):

```ts
  const cityMask = texture(textures.night, uv()).rgb.r.mul(land);
  const night = smoothstep(0.14, -0.2, ndl);
```

(`withCities` below stays the same — it already uses `cityMask`, `night`, `cityBrightness`.)

- [ ] **Step 7: Build.**

Run: `cd frontend && npx tsc -b && npx vite build`
Expected: zero TS errors, build succeeds. Grep to confirm no dangling references: `grep -n "mx_fractal_noise_float\|landMask\|oceanLush" src/orbital/scene/Planet.tsx` — the surface block should no longer reference the removed names (storms may still use noise — that's fine).

- [ ] **Step 8: Visual check.** Start the dev server (`npx vite`) and open the orbital landing with fixtures. Use Playwright MCP to screenshot `?worldFixture=great`, `avg`, `bad`:
  - great → vivid full-color Earth; bad → visibly desaturated/dim Earth; real continents + night-lights on the dark limb; ocean glint sparkle on the day side.

- [ ] **Step 9: Commit.**

```bash
git add frontend/public/orbital frontend/src/orbital/scene/Planet.tsx
git commit -m "feat(orbital): real Earth textures, recovery grades albedo, sunDir uniform"
```

---

### Task 3: solarClock — pure solar math + hook (TDD)

**Files:**
- Create: `frontend/src/orbital/solarClock.ts`
- Create: `frontend/src/orbital/solarClock.test.ts`

- [ ] **Step 1: Write the failing tests.**

```ts
// solarClock.test.ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SWING,
  solarAzimuth,
  solarDayFraction,
  solarWarmth,
  sunDirFor,
} from "./solarClock";

const at = (h: number, m = 0) => new Date(2026, 5, 13, h, m);

describe("solarDayFraction", () => {
  it("noon = 0.5, midnight = 0", () => {
    expect(solarDayFraction(at(12))).toBeCloseTo(0.5);
    expect(solarDayFraction(at(0))).toBeCloseTo(0);
    expect(solarDayFraction(at(6))).toBeCloseTo(0.25);
  });
});

describe("solarWarmth", () => {
  it("peaks at noon, zero at midnight, symmetric", () => {
    expect(solarWarmth(0.5)).toBeCloseTo(1);
    expect(solarWarmth(0)).toBeCloseTo(0);
    expect(solarWarmth(0.25)).toBeLessThan(solarWarmth(0.5));
    expect(solarWarmth(0.25)).toBeCloseTo(solarWarmth(0.75));
  });
});

describe("solarAzimuth", () => {
  it("zero at noon, signed, magnitude bounded by swing", () => {
    expect(solarAzimuth(0.5, DEFAULT_SWING)).toBeCloseTo(0);
    expect(solarAzimuth(0.75, DEFAULT_SWING)).toBeGreaterThan(0);
    expect(solarAzimuth(0.25, DEFAULT_SWING)).toBeLessThan(0);
    expect(Math.abs(solarAzimuth(0, DEFAULT_SWING))).toBeLessThanOrEqual(DEFAULT_SWING + 1e-9);
  });
});

describe("sunDirFor", () => {
  it("returns a unit vector", () => {
    const [x, y, z] = sunDirFor(0.5);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1);
  });
  it("noon faces the camera (+z) more than midnight", () => {
    expect(sunDirFor(0.5)[2]).toBeGreaterThan(sunDirFor(0)[2]);
  });
});
```

- [ ] **Step 2: Run, expect failure.**

Run: `cd frontend && npx vitest run src/orbital/solarClock.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `solarClock.ts`.**

```ts
import { useEffect, useMemo, useState } from "react";

/** Azimuth swing from noon to midnight (radians). < π keeps the lit crescent
 *  broadly consistent with the fixed strain-star's on-screen position. */
export const DEFAULT_SWING = 0.62 * Math.PI;
const BASE_ELEVATION = 0.22; // radians — modest, fixed (no season/latitude in v1)

/** Local time as a 0..1 fraction of the day (0 = midnight, 0.5 = noon). */
export function solarDayFraction(d: Date): number {
  return (d.getHours() * 60 + d.getMinutes()) / 1440;
}

/** Daylight amount 0..1 — 1 at noon, 0 at midnight, symmetric around noon. */
export function solarWarmth(f: number): number {
  return 0.5 - 0.5 * Math.cos(2 * Math.PI * f);
}

/** Signed azimuth offset from noon (radians), bounded by `swing`. */
export function solarAzimuth(f: number, swing = DEFAULT_SWING): number {
  return (f - 0.5) * 2 * swing;
}

/** Unit sun direction: noon points toward +z (camera) and slightly up;
 *  it swings around the polar (y) axis with local time. */
export function sunDirFor(
  f: number,
  opts?: { swing?: number; elevation?: number },
): [number, number, number] {
  const az = solarAzimuth(f, opts?.swing ?? DEFAULT_SWING);
  const elev = opts?.elevation ?? BASE_ELEVATION;
  const cy = Math.cos(elev);
  return [Math.sin(az) * cy, Math.sin(elev), Math.cos(az) * cy];
}

// Deterministic overrides for screenshots: ?timeFixture=dawn|noon|dusk|night
const TIME_FIXTURES: Record<string, number> = {
  dawn: 0.27,
  noon: 0.5,
  dusk: 0.79,
  night: 0.96,
};

export function readTimeFixture(): number | null {
  if (typeof location === "undefined") return null;
  const name = new URLSearchParams(location.search).get("timeFixture");
  return name == null ? null : (TIME_FIXTURES[name] ?? null);
}

export interface SolarState {
  sunDir: [number, number, number];
  warmth: number;
}

/** Ambient clock layer — ticks each minute; frozen when a fixture is set. */
export function useSolarClock(): SolarState {
  const fixture = readTimeFixture();
  const [f, setF] = useState(() => fixture ?? solarDayFraction(new Date()));
  useEffect(() => {
    if (fixture != null) return; // frozen for deterministic screenshots
    const id = setInterval(() => setF(solarDayFraction(new Date())), 60_000);
    return () => clearInterval(id);
  }, [fixture]);
  return useMemo(() => ({ sunDir: sunDirFor(f), warmth: solarWarmth(f) }), [f]);
}
```

- [ ] **Step 4: Run, expect pass.**

Run: `cd frontend && npx vitest run src/orbital/solarClock.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add frontend/src/orbital/solarClock.ts frontend/src/orbital/solarClock.test.ts
git commit -m "feat(orbital): solarClock — local time-of-day sun direction + warmth"
```

---

### Task 4: Wire time-of-day into the planet + slow drift

**Files:**
- Modify: `frontend/src/orbital/index.tsx`
- Modify: `frontend/src/orbital/scene/Planet.tsx`

- [ ] **Step 1: Provide solar state in `index.tsx`.** Import the hook and call it in `OrbitalWorld` (alongside the other top-level atom reads):

```ts
import { useSolarClock } from "./solarClock";
// ...inside OrbitalWorld():
const solar = useSolarClock();
```

Pass it to the `<Planet>` element (find the `<Planet world={...} .../>` usage and add props):

```tsx
<Planet world={world} sunDir={solar.sunDir} warmth={solar.warmth} /* ...existing props */ />
```

- [ ] **Step 2: Accept the new props in `Planet.tsx`.** Add to the component prop type and signature:

```ts
export default function Planet({
  world,
  sunDir,
  warmth,
  onSelect,
  hovered = false,
}: {
  world: WorldState;
  sunDir: [number, number, number];
  warmth: number;
  onSelect?: () => void;
  hovered?: boolean;
}) {
```

- [ ] **Step 3: Add `damp3` import and a reusable target vector.** At the top: `import { damp, damp3 } from "maath/easing";`. Inside the component add a stable scratch vector: `const sunTarget = useRef(new THREE.Vector3(...sunDir));` is not needed — build it in `useFrame` from the prop.

- [ ] **Step 4: Damp the uniforms + slow the rotation in `useFrame`.** Add inside the existing `useFrame` body (after the other `damp` calls):

```ts
    sunTarget.set(sunDir[0], sunDir[1], sunDir[2]);
    damp3(uniforms.sunDir.value, sunTarget, 3, dt);
    damp(uniforms.warmth, "value", warmth, 3, dt);
```

Declare `const sunTarget = useMemo(() => new THREE.Vector3(), []);` near the other refs. Then change the rotation apply line so RHR only drives a gentle drift:

```ts
    const DRIFT = 0.12; // RHR rotation scaled to ~1 turn / 30+ min so the terminator reads
    if (group.current) group.current.rotation.y += rotSpeed.current * DRIFT * dt * RM;
```

- [ ] **Step 5: Build + full test run.**

Run: `cd frontend && npx tsc -b && npx vite build && npx vitest run`
Expected: all green.

- [ ] **Step 6: Visual check — the time-of-day matrix.** With the dev server running, Playwright MCP screenshot the four states on the orbital landing:
  - `?timeFixture=dawn` → warm amber rake, terminator on one limb
  - `?timeFixture=noon` → neutral bright day face
  - `?timeFixture=dusk` → warm low light, terminator on the other limb
  - `?timeFixture=night` → cool/dim, city lights prominent on the camera-facing side

  Confirm the lit crescent never reads as fighting the on-screen strain-star position. If it does, lower `DEFAULT_SWING` in `solarClock.ts` (e.g., to `0.45 * Math.PI`) and re-shoot — this is the coherence tuning knob called out in the spec.

- [ ] **Step 7: Commit.**

```bash
git add frontend/src/orbital/index.tsx frontend/src/orbital/scene/Planet.tsx
git commit -m "feat(orbital): planet terminator + warmth follow local clock, slow drift"
```

---

### Task 5: Verification matrix + polish + gate

**Files:**
- None new (tuning + verification only).

- [ ] **Step 1: Full verification gate.**

Run: `cd frontend && npx tsc -b && npx vite build && npx vitest run`
Expected: all green. Backend untouched — do **not** run/modify backend.

- [ ] **Step 2: Screenshot matrix.** With the dev server up, capture the 3×4 grid via Playwright MCP — `?worldFixture={great,avg,bad}` crossed with `?timeFixture={dawn,noon,dusk,night}` (combine query params, e.g. `?worldFixture=bad&timeFixture=night`). Confirm in each cell:
  - aurora hue matches the recovery band (red depleted → mint peak), brightness still tracks HRV (unchanged from before)
  - Earth albedo graded by recovery (vivid → washed)
  - terminator + warmth correct for the time fixture
  - night-side city lights on real geography

- [ ] **Step 3: Present screenshots to the user for the polish round.** Tuning targets (all are starting values, expect iteration): `DEFAULT_SWING`/`BASE_ELEVATION` (coherence), the recovery-grade desaturation strength (`0.55`/`0.85` in Planet Step 4), warmth tint endpoints, aurora ramp brightness (`mul(1.8)`). Apply requested tweaks, re-shoot.

- [ ] **Step 4: Reduced-motion + perf sanity.** Confirm the existing perf-degrade ratchet and `prefers-reduced-motion` paths still behave (textures add GPU cost — verify `?worldFixture` scenes hold framerate; the existing PerfMonitor handles degrade). No new perf code expected; note any regression for a follow-up.

- [ ] **Step 5: Final commit (if polish tweaks were made).**

```bash
git add -A frontend/src/orbital
git commit -m "feat(orbital): living-earth polish pass"
```

---

## Self-Review Notes

- **Spec coverage:** Feature 1 aurora→recovery (Task 1, with `recovery01` + palette ramp, HRV intensity untouched). Feature 2 real Earth tier-A (Task 2: day+night textures, recovery grade, derived sea-mask glint, storms unchanged, `sunDir` uniform). Feature 3 time-of-day (Task 3 pure math + hook + fixture; Task 4 wiring + warmth + slow-drift rotation). Tests updated (Task 1, 3). Out-of-scope items (weather, cloud/relief textures, camera orbit, geolocation) are simply not implemented. Verification gate = Task 5.
- **Sea mask deviation from spec:** the spec listed an `earth-mask.jpg` asset; this plan derives the sea mask in-shader from ocean blue-dominance instead — one fewer asset/download, same purpose (gating ocean glint). Functionally equivalent for v1; noted here intentionally.
- **Placeholder scan:** no TBDs; every code step shows full code; tuning constants are explicitly starting values for the polish round (Task 5), consistent with the existing orbital plan's approach to shader constants.
- **Type consistency:** `recovery01` defined in Task 1 (worldState) and consumed in Task 1 (Aurora uniform). `sunDir: [number,number,number]` + `warmth: number` defined in solarClock (Task 3), consumed identically in Planet props + index wiring (Task 4). `uniforms.sunDir`/`uniforms.warmth` added in Task 2, damped in Task 4. `useSolarClock` returns `{ sunDir, warmth }` matching the Planet props.
