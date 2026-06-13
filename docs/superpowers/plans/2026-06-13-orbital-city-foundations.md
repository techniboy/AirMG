# Orbital City Foundations + Recovery-year Facade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat recharts recovery-year heatmap with a luminous 3D tower facade you descend to from `/trends`, shipping the four reusable Data City foundations (descent, shared luminous material, HCF palette, ghost-baseline overlay).

**Architecture:** Pure data/palette modules feed a shared TSL material factory; one diorama component (`RecoveryFacade`) renders two `InstancedMesh` facades (lit + ghost baseline) near the planet night-side, faded in by an `active` prop + damped `master` uniform exactly like the shipped `SleepDescent`. The existing `cameraRig` dives the camera via a new `/trends` target.

**Tech Stack:** React + `@react-three/fiber`, `three/webgpu` + `three/tsl` node materials, `maath/easing`, `jotai`, `vitest`. Spec: `docs/superpowers/specs/2026-06-13-orbital-city-foundations-design.md`.

---

## File Structure

- **Create** `frontend/src/orbital/palette.ts` — HCF accent constants, `neonGrade()`, `recoveryBucket()`, `recoveryNeon()`.
- **Create** `frontend/src/orbital/palette.test.ts` — bucket boundary asserts.
- **Create** `frontend/src/orbital/yearFacade.ts` — `asYearFacade()`: 365 days → grid cells + rolling-90 baseline + summary.
- **Create** `frontend/src/orbital/yearFacade.test.ts` — layout + baseline math.
- **Create** `frontend/src/orbital/scene/facadeMaterial.ts` — `createLuminousMaterial()` factory (the shared foundation).
- **Create** `frontend/src/orbital/scene/RecoveryFacade.tsx` — the diorama (lit facade, ghost, hover, fade, dispose).
- **Modify** `frontend/src/orbital/cameraRig.tsx` — add `CAMERA_TARGETS["/trends"]`.
- **Modify** `frontend/src/orbital/index.tsx` — wire data + mount component + a11y mirror.

All `three` imports use `three/webgpu` (as `THREE`) and `three/tsl`, matching every existing scene file.

---

## Task 1: Palette module (HCF tokens + neon grade)

**Files:**
- Create: `frontend/src/orbital/palette.ts`
- Test: `frontend/src/orbital/palette.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/orbital/palette.test.ts
import { describe, expect, it } from "vitest";
import { recoveryBucket, recoveryNeon, neonGrade } from "./palette";

describe("recoveryBucket", () => {
  it("maps recovery score to the 5-bucket scale (same thresholds as YearHeatStrip)", () => {
    expect(recoveryBucket(10)).toBe("#FF4F73");
    expect(recoveryBucket(32)).toBe("#FF4F73");
    expect(recoveryBucket(33)).toBe("#F5A623");
    expect(recoveryBucket(49)).toBe("#F5A623");
    expect(recoveryBucket(50)).toBe("#E8C24B");
    expect(recoveryBucket(66)).toBe("#E8C24B");
    expect(recoveryBucket(67)).toBe("#18C98B");
    expect(recoveryBucket(84)).toBe("#18C98B");
    expect(recoveryBucket(85)).toBe("#2FE6A8");
    expect(recoveryBucket(100)).toBe("#2FE6A8");
  });
});

describe("neonGrade / recoveryNeon", () => {
  it("lifts lightness to at least 0.55 so additive color clears bloom", () => {
    const hsl = { h: 0, s: 0, l: 0 };
    neonGrade("#2C3A7A").getHSL(hsl); // a dark color
    expect(hsl.l).toBeGreaterThanOrEqual(0.55);
  });
  it("recoveryNeon picks different colors across bucket boundaries", () => {
    expect(recoveryNeon(32).getHexString()).not.toBe(recoveryNeon(34).getHexString());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/orbital/palette.test.ts`
Expected: FAIL — cannot resolve `./palette`.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/orbital/palette.ts
import * as THREE from "three/webgpu";

/**
 * HCF accent set (vision §6) — used for the ghost frame, scanline tint, and
 * chip accents. NOT the primary data color: recovery windows keep the shipped
 * recovery scale, only neon-graded.
 */
export const HCF = {
  amber: "#ffb347",
  magenta: "#ff2d78",
  cyan: "#16d8e8",
  indigo: "#8a4dff",
  phosphor: "#7dff9b",
} as const;

const _hsl = { h: 0, s: 0, l: 0 };

/**
 * Lift saturation + floor lightness so an additive/bloomed color clears the
 * post chain. Same idiom as SleepDescent's STAGE_GLOW, extracted here so it
 * stops being copy-pasted across scene files.
 */
export function neonGrade(hex: string): THREE.Color {
  const c = new THREE.Color(hex);
  c.getHSL(_hsl);
  c.setHSL(_hsl.h, Math.min(1, _hsl.s * 1.1), Math.max(_hsl.l, 0.55));
  return c;
}

/** recovery 0..100 → 5-bucket base hex (same thresholds as YearHeatStrip). */
export function recoveryBucket(value: number): string {
  if (value < 33) return "#FF4F73";
  if (value < 50) return "#F5A623";
  if (value < 67) return "#E8C24B";
  if (value < 85) return "#18C98B";
  return "#2FE6A8";
}

/** Single source of truth for "recovery as a neon color." */
export function recoveryNeon(value: number): THREE.Color {
  return neonGrade(recoveryBucket(value));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/orbital/palette.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/orbital/palette.ts frontend/src/orbital/palette.test.ts
git commit -m "feat(orbital): HCF palette tokens + neon-grade helpers"
```

---

## Task 2: Year-facade data layer (layout + rolling-90 baseline)

**Files:**
- Create: `frontend/src/orbital/yearFacade.ts`
- Test: `frontend/src/orbital/yearFacade.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/orbital/yearFacade.test.ts
import { describe, expect, it } from "vitest";
import { asYearFacade } from "./yearFacade";

// helper: build N consecutive UTC days starting at a Monday (2026-06-01 is a Monday)
function series(start: string, values: (number | null)[]) {
  const out: { day: string; recovery: number | null }[] = [];
  const base = new Date(start + "T00:00:00Z");
  for (let i = 0; i < values.length; i++) {
    const d = new Date(base.getTime() + i * 86400000);
    out.push({ day: d.toISOString().slice(0, 10), recovery: values[i] });
  }
  return out;
}

describe("asYearFacade layout", () => {
  it("returns null for empty input", () => {
    expect(asYearFacade(undefined)).toBeNull();
    expect(asYearFacade([])).toBeNull();
  });

  it("maps weekday to col (Mon=0) and week to row, today at the highest row", () => {
    // 9 days from Mon 2026-06-01 → spans 2 weeks
    const f = asYearFacade(series("2026-06-01", [50, 50, 50, 50, 50, 50, 50, 50, 50]))!;
    const first = f.cells[0];
    const last = f.cells[f.cells.length - 1];
    expect(first.col).toBe(0);  // Monday
    expect(first.row).toBe(0);  // first week
    expect(last.col).toBe(1);   // 9th day = Tuesday
    expect(last.row).toBe(1);   // second week
    expect(f.summary.todayRow).toBe(1);
    expect(last.row).toBe(f.summary.todayRow); // today renders at the rooftop
  });
});

describe("asYearFacade baseline", () => {
  it("is null until the minimum sample count, then equals the trailing mean", () => {
    const f = asYearFacade(series("2026-06-01", Array(20).fill(60)))!;
    expect(f.cells[0].baseline).toBeNull();   // < BASELINE_MIN samples
    expect(f.cells[13].baseline).toBeNull();  // 14th day: still below min on day 13 index? boundary check
    expect(f.cells[19].baseline).toBeCloseTo(60, 5);
    expect(f.cells[19].delta).toBeCloseTo(0, 5);
  });

  it("ignores null days in the baseline window and computes delta sign", () => {
    const vals = Array(20).fill(40);
    vals[19] = 80; // today spikes above its trailing baseline
    const f = asYearFacade(series("2026-06-01", vals))!;
    expect(f.cells[19].value).toBe(80);
    expect(f.cells[19].baseline).toBeLessThan(80);
    expect(f.cells[19].delta!).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/orbital/yearFacade.test.ts`
Expected: FAIL — cannot resolve `./yearFacade`.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/orbital/yearFacade.ts

export interface FacadeCell {
  col: number; // 0..6 ISO weekday (Mon=0 … Sun=6) → window column
  row: number; // week index (0 = oldest week) → tower floor
  day: string; // "YYYY-MM-DD"
  value: number | null;
  baseline: number | null; // rolling-90 personal mean
  delta: number | null; // value - baseline
}

export interface FacadeSummary {
  mean: number | null; // mean of all non-null recovery
  count: number; // days with data
  rows: number; // total floors (max row + 1)
  todayCol: number;
  todayRow: number;
}

export interface YearFacade {
  cells: FacadeCell[];
  summary: FacadeSummary;
}

const BASELINE_WINDOW = 90; // calendar-day trailing window
const BASELINE_MIN = 14; // require this many samples before showing a baseline

const EPOCH_DAY = 86400000;
const epochDay = (d: Date) => Math.floor(d.getTime() / EPOCH_DAY);
const isoWeekday = (d: Date) => (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
// epoch-day index of the Monday that opens this date's week
const mondayOf = (d: Date) => epochDay(d) - isoWeekday(d);

export function asYearFacade(
  days: { day: string; recovery: number | null }[] | undefined,
): YearFacade | null {
  if (!days || days.length === 0) return null;

  const parsed = [...days]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((r) => ({
      day: r.day,
      date: new Date(`${r.day}T00:00:00Z`),
      value: r.recovery,
    }));

  // rolling-90 baseline per day (calendar window, nulls skipped)
  const baselines: (number | null)[] = parsed.map((p, i) => {
    const di = epochDay(p.date);
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0; j -= 1) {
      if (di - epochDay(parsed[j].date) > BASELINE_WINDOW - 1) break;
      if (parsed[j].value != null) {
        sum += parsed[j].value as number;
        n += 1;
      }
    }
    return n >= BASELINE_MIN ? sum / n : null;
  });

  const firstMonday = Math.min(...parsed.map((p) => mondayOf(p.date)));

  const cells: FacadeCell[] = parsed.map((p, i) => {
    const baseline = baselines[i];
    return {
      col: isoWeekday(p.date),
      row: (mondayOf(p.date) - firstMonday) / 7,
      day: p.day,
      value: p.value,
      baseline,
      delta: p.value != null && baseline != null ? p.value - baseline : null,
    };
  });

  const present = parsed.filter((p) => p.value != null) as { value: number }[];
  const last = cells[cells.length - 1];
  const summary: FacadeSummary = {
    mean: present.length
      ? present.reduce((a, b) => a + b.value, 0) / present.length
      : null,
    count: present.length,
    rows: Math.max(...cells.map((c) => c.row)) + 1,
    todayCol: last.col,
    todayRow: last.row,
  };

  return { cells, summary };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/orbital/yearFacade.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/orbital/yearFacade.ts frontend/src/orbital/yearFacade.test.ts
git commit -m "feat(orbital): year-facade data layer with rolling-90 baseline"
```

---

## Task 3: Shared luminous-facade material factory

**Files:**
- Create: `frontend/src/orbital/scene/facadeMaterial.ts`

This is a TSL material (GPU shader graph) — not unit-tested; it is verified visually in Task 4+. Keep it a pure factory so Spec 3+ elements reuse it.

- [ ] **Step 1: Write the factory**

```ts
// frontend/src/orbital/scene/facadeMaterial.ts
import * as THREE from "three/webgpu";
import {
  float,
  instanceIndex,
  instancedBufferAttribute,
  sin,
  time,
  uniform,
  uv,
  vec4,
} from "three/tsl";

export interface LuminousMaterial {
  material: THREE.MeshBasicNodeMaterial;
  /** per-instance RGB; write 3 floats per cell then set needsUpdate = true */
  colorAttr: THREE.InstancedBufferAttribute;
  master: ReturnType<typeof uniform>; // 0..1 fade, damped by the scene
  scanAmp: ReturnType<typeof uniform>; // scanline amplitude (0 on low quality)
  flickAmp: ReturnType<typeof uniform>; // flicker amplitude (0 on low / reduced-motion)
}

/**
 * The shared "luminous cell" material every Data City element inherits
 * (vision §3). Instanced, additively-blended emissive cells with a subtle
 * scanline + low-frequency flicker, echoing Planet.tsx's night-city flicker so
 * the city reads as the same world. Amplitudes are uniforms so the scene can
 * collapse them to 0 for the perf ratchet / reduced motion.
 */
export function createLuminousMaterial(opts: {
  count: number;
  brightness?: number;
  scanline?: number;
  flicker?: number;
}): LuminousMaterial {
  const { count, brightness = 1, scanline = 0.18, flicker = 0.12 } = opts;

  const colorAttr = new THREE.InstancedBufferAttribute(
    new Float32Array(count * 3),
    3,
  );
  const master = uniform(0);
  const scanAmp = uniform(scanline);
  const flickAmp = uniform(flicker);

  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const cellColor = instancedBufferAttribute<"vec3">(colorAttr, "vec3");
  // static horizontal scanline within each window (uv-based, no animation)
  const scan = sin(uv().y.mul(18)).mul(0.5).add(0.5).mul(scanAmp);
  // per-instance phase so windows don't flicker in lockstep
  const phase = float(instanceIndex).mul(0.37);
  const flick = sin(time.mul(7).add(phase)).mul(0.5).add(0.5).mul(flickAmp);
  const lum = float(brightness).sub(scan).add(flick);

  // ×2 emissive lift so graded colors clear the bloom threshold
  material.colorNode = vec4(cellColor.mul(lum).mul(2), 1);
  material.opacityNode = master;

  return { material, colorAttr, master, scanAmp, flickAmp };
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors from `facadeMaterial.ts` (other pre-existing errors, if any, are out of scope).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/orbital/scene/facadeMaterial.ts
git commit -m "feat(orbital): shared luminous-facade material factory"
```

---

## Task 4: RecoveryFacade — lit facade (geometry, colors, fade)

**Files:**
- Create: `frontend/src/orbital/scene/RecoveryFacade.tsx`

Build the lit facade first; ghost + hover come in Tasks 5–6. Mirrors `SleepDescent.tsx`: `active` prop, damped `master`, `group.visible` gate, dispose on rebuild/unmount.

- [ ] **Step 1: Write the component (lit facade only)**

```tsx
// frontend/src/orbital/scene/RecoveryFacade.tsx
import { useFrame } from "@react-three/fiber";
import { damp } from "maath/easing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three/webgpu";
import { recoveryNeon } from "../palette";
import type { YearFacade } from "../yearFacade";
import { createLuminousMaterial } from "./facadeMaterial";

// facade-local layout
const CELL = 0.07;
const GAP = 0.022;
const STEP = CELL + GAP;
const NULL_CELL = new THREE.Color(0.04, 0.05, 0.08); // dim recessed = no data

// Starting placement — a standalone structure floating off the planet
// night-side, facing the descent camera. TUNE these together with the
// /trends camera target via the dev `window.__orbital` hook, exactly as
// SleepDescent's arc transform was grid-searched. Document final values here.
export const FACADE_ANCHOR = new THREE.Vector3(-0.8, 0, 2.4);

interface Built {
  geometry: THREE.PlaneGeometry;
  litMesh: THREE.InstancedMesh;
  lit: ReturnType<typeof createLuminousMaterial>;
  /** local position of each instance (for hover chip placement later) */
  positions: THREE.Vector3[];
}

function build(facade: YearFacade): Built {
  const { cells, summary } = facade;
  const count = cells.length;
  const geometry = new THREE.PlaneGeometry(CELL, CELL);

  const lit = createLuminousMaterial({ count });
  const litMesh = new THREE.InstancedMesh(geometry, lit.material, count);
  litMesh.frustumCulled = false;

  // center the grid around the group origin
  const cx = (6 / 2) * STEP; // 7 cols → center offset
  const cy = ((summary.rows - 1) / 2) * STEP;

  const m = new THREE.Matrix4();
  const positions: THREE.Vector3[] = [];
  for (let i = 0; i < count; i += 1) {
    const c = cells[i];
    const p = new THREE.Vector3(c.col * STEP - cx, c.row * STEP - cy, 0);
    positions.push(p);
    m.makeTranslation(p.x, p.y, p.z);
    litMesh.setMatrixAt(i, m);
    const col = c.value != null ? recoveryNeon(c.value) : NULL_CELL;
    lit.colorAttr.setXYZ(i, col.r, col.g, col.b);
  }
  litMesh.instanceMatrix.needsUpdate = true;
  lit.colorAttr.needsUpdate = true;

  return { geometry, litMesh, lit, positions };
}

export default function RecoveryFacade({
  facade,
  active,
  quality,
}: {
  facade: YearFacade | null;
  active: boolean;
  quality: "high" | "low";
}) {
  const group = useRef<THREE.Group>(null);
  const built = useMemo(() => (facade ? build(facade) : null), [facade]);

  useEffect(() => {
    if (!built) return;
    return () => {
      built.geometry.dispose();
      built.lit.material.dispose();
    };
  }, [built]);

  // perf ratchet: kill scanline + flicker on low quality
  useEffect(() => {
    if (!built) return;
    const low = quality === "low";
    built.lit.scanAmp.value = low ? 0 : 0.18;
    built.lit.flickAmp.value = low ? 0 : 0.12;
  }, [built, quality]);

  useFrame((_, rawDelta) => {
    if (!built) return;
    const dt = Math.min(rawDelta, 0.1);
    damp(built.lit.master, "value", active ? 1 : 0, 0.35, dt);
    if (group.current)
      group.current.visible = active || built.lit.master.value > 0.004;
  });

  if (!built) return null;

  return (
    <group ref={group} position={FACADE_ANCHOR} visible={false}>
      <primitive object={built.litMesh} />
    </group>
  );
}
```

- [ ] **Step 2: Wire a temporary mount to see it (scaffolding)**

In `frontend/src/orbital/index.tsx`, add imports and a temporary mount. Add near the other scene imports:

```tsx
import RecoveryFacade from "./scene/RecoveryFacade";
import { asYearFacade } from "./yearFacade";
import { yearRecoveryAtom } from "../atoms/api";
```

Inside the component body, near the other `useAtomValue` data reads:

```tsx
  const yearQuery = useAtomValue(yearRecoveryAtom);
  const facade = useMemo(
    () =>
      asYearFacade(
        yearQuery.data?.days?.map((d) => ({ day: d.day, recovery: d.recovery })),
      ),
    [yearQuery.data],
  );
  const onTrends = location.pathname === "/trends";
```

Inside the `<Canvas>` tree (near `<SleepDescent .../>`):

```tsx
          <RecoveryFacade facade={facade} active={onTrends} quality={quality} />
```

- [ ] **Step 3: Run the app and verify the lit facade renders**

Run: `cd frontend && npm run dev` (Vite). Open the app, navigate to `/trends`.
Expected: a tall grid of glowing colored windows appears near the planet (placement rough — that's fine, Task 7 tunes the camera). Colors span the recovery scale; empty days are dim. Switching away from `/trends` fades it out.

If the WebGPU `__orbital` hook is needed for screenshots, it is exposed on `window.__orbital` in dev (see `index.tsx` `onCreated`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/orbital/scene/RecoveryFacade.tsx frontend/src/orbital/index.tsx
git commit -m "feat(orbital): recovery-year lit facade (instanced windows + fade)"
```

---

## Task 5: Ghost-baseline layer

**Files:**
- Modify: `frontend/src/orbital/scene/RecoveryFacade.tsx`

Add the dim baseline-colored duplicate behind the lit facade, offset in −Z and scaled up so its edges read as a zoning envelope.

- [ ] **Step 1: Extend `Built` and `build()`**

Add to the `Built` interface:

```tsx
  ghostMesh: THREE.InstancedMesh;
  ghost: ReturnType<typeof createLuminousMaterial>;
```

Add these constants near the top:

```tsx
const GHOST_Z = -0.12;
const GHOST_SCALE = 1.06;
const GHOST_NULL = new THREE.Color(0.02, 0.02, 0.03);
```

In `build()`, after the lit loop and before `return`, add the ghost mesh (reuse the same `positions`):

```tsx
  const ghost = createLuminousMaterial({
    count,
    brightness: 0.5,
    scanline: 0.06,
    flicker: 0,
  });
  const ghostMesh = new THREE.InstancedMesh(geometry, ghost.material, count);
  ghostMesh.frustumCulled = false;
  for (let i = 0; i < count; i += 1) {
    const c = cells[i];
    const p = positions[i];
    m.makeTranslation(p.x * GHOST_SCALE, p.y * GHOST_SCALE, GHOST_Z);
    ghostMesh.setMatrixAt(i, m);
    const col = c.baseline != null ? recoveryNeon(c.baseline) : GHOST_NULL;
    ghost.colorAttr.setXYZ(i, col.r, col.g, col.b);
  }
  ghostMesh.instanceMatrix.needsUpdate = true;
  ghost.colorAttr.needsUpdate = true;
```

Update the `return` to include `ghostMesh, ghost`.

- [ ] **Step 2: Dispose, fade, and render the ghost**

In the dispose `useEffect`, add: `built.ghost.material.dispose();`

In the quality `useEffect`, add: `built.ghost.scanAmp.value = low ? 0 : 0.06;` (ghost flicker stays 0).

In `useFrame`, damp the ghost master with the lit one:

```tsx
    damp(built.ghost.master, "value", active ? 0.7 : 0, 0.35, dt);
```

In the returned JSX, add inside the `<group>`:

```tsx
      <primitive object={built.ghostMesh} />
```

- [ ] **Step 3: Run the app and verify**

Run: `cd frontend && npm run dev`, go to `/trends`.
Expected: behind the bright lit windows, a dimmer baseline-colored facade peeks around the edges (the zoning envelope). Where recovery ≈ baseline the colors match; where a day diverges its lit window stands out against its ghost.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/orbital/scene/RecoveryFacade.tsx
git commit -m "feat(orbital): ghost-baseline facade overlay (zoning envelope)"
```

---

## Task 6: Hover chip + a11y mirror

**Files:**
- Modify: `frontend/src/orbital/scene/RecoveryFacade.tsx`

Raycast the lit mesh → show exact numbers. Honest viz requirement.

- [ ] **Step 1: Add hover state, formatting, and the chip**

Add imports at the top of the file:

```tsx
import { Html } from "@react-three/drei";
import { type ThreeEvent } from "@react-three/fiber";
import { useState } from "react";
```

Add a formatter above the component:

```tsx
function chipText(c: { day: string; value: number | null; baseline: number | null; delta: number | null }): string {
  const date = new Date(`${c.day}T00:00:00Z`).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
  if (c.value == null) return `${date} · no data`;
  const base =
    c.baseline != null
      ? ` · vs ${Math.round(c.baseline)}% normal · ${c.delta! >= 0 ? "+" : ""}${Math.round(c.delta!)}`
      : "";
  return `${date} · ${Math.round(c.value)}%${base}`;
}
```

Inside the component, add hover state and handlers (the cells live on `facade.cells`, aligned by instance index with `built.positions`):

```tsx
  const [hover, setHover] = useState<number | null>(null);

  // leaving the route mid-hover never fires pointerout — unstick the chip
  const [prevActive, setPrevActive] = useState(active);
  if (prevActive !== active) {
    setPrevActive(active);
    setHover(null);
  }

  const onMove = active
    ? (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        if (e.instanceId != null) setHover(e.instanceId);
      }
    : undefined;
  const onOut = active ? () => setHover(null) : undefined;
```

Attach handlers to the lit mesh and render the chip. Replace the lit `<primitive>` line with:

```tsx
      <primitive
        object={built.litMesh}
        onPointerMove={onMove}
        onPointerOut={onOut}
      />
      {hover != null && active && facade && (
        <Html
          position={built.positions[hover]}
          center
          style={{ pointerEvents: "none" }}
          zIndexRange={[5, 0]}
        >
          <div className="orbital-chip">{chipText(facade.cells[hover])}</div>
        </Html>
      )}
```

(`facade` is non-null here because `built` exists; the guard satisfies TS.)

- [ ] **Step 2: Add the a11y mirror in index.tsx**

In `frontend/src/orbital/index.tsx`, inside the `.orbital-sr-nav` block, add a button + summary so the data exists without the canvas:

```tsx
        <button type="button" className="orbital-sr-only" onClick={() => navigate("/trends")}>
          View recovery year facade
        </button>
```

And below it (still inside the a11y region), a visually-hidden readout:

```tsx
        {facade && (
          <p className="orbital-sr-only">
            {`Recovery year: ${facade.summary.count} days, mean ${
              facade.summary.mean != null ? Math.round(facade.summary.mean) : "—"
            }%.`}
          </p>
        )}
```

- [ ] **Step 3: Run the app and verify**

Run: `cd frontend && npm run dev`, go to `/trends`, hover windows.
Expected: chip shows e.g. `Jun 10 · 72% · vs 64% normal · +8`; empty days show `· no data`; chip clears on pointer-out and on leaving `/trends`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/orbital/scene/RecoveryFacade.tsx frontend/src/orbital/index.tsx
git commit -m "feat(orbital): facade hover chip (exact recovery vs baseline) + a11y mirror"
```

---

## Task 7: Descent camera target + framing tune

**Files:**
- Modify: `frontend/src/orbital/cameraRig.tsx`
- Modify: `frontend/src/orbital/scene/RecoveryFacade.tsx` (tune `FACADE_ANCHOR` only)

- [ ] **Step 1: Add the `/trends` camera target**

In `cameraRig.tsx`, add to `CAMERA_TARGETS` (starting values — tune in Step 3):

```tsx
  "/trends": { pos: [-0.8, 0.2, 6.2], look: [-0.8, 0.2, 2.4] },
```

- [ ] **Step 2: Make the facade the `/trends` hero (drop the occluding glass console)**

The facade is the interactive hero; the frosted `.console-layer` would cover it and block hover. Per vision §2, the descent *replaces* the flat console-panel route. So `/trends` no longer mounts `ConsolePanel`, and the now-redundant flat heatmap card goes away.

In `frontend/src/orbital/index.tsx`, remove the `/trends` entry from `CONSOLE_PAGES` (delete the line):

```tsx
  "/trends": { title: "Trends", Page: Trends },
```

If `Trends` / its import become unused, drop the now-dead import too (the linter in Task 8 will flag it).

In `frontend/src/pages/Trends.tsx`, delete the redundant Year heat strip card (the facade replaces it) — remove this block:

```tsx
			{/* Year heat strip */}
			{yearData?.days && yearData.days.length > 0 && (
				<Card className="border-hairline bg-surface-raised p-4 space-y-2">
					<div className="text-sm font-medium text-text-secondary">Recovery · Past Year</div>
					<YearHeatStrip data={yearData.days.map((d) => ({ day: d.day, value: d.recovery }))} />
				</Card>
			)}
```

…and remove the now-unused `YearHeatStrip` import + `yearRecoveryAtom` usage from `Trends.tsx` if nothing else there needs them (linter confirms).

> Note: this temporarily removes the recharts Trends page from `/trends`. Its per-metric trend charts return as dedicated city elements in Spec 4+ (per the spec's "Out of scope"). The standalone `YearHeatStrip` component file is left in place (harmless) unless the linter flags it as unused.

- [ ] **Step 3: Tune anchor + camera so the facade fills frame with the planet limb in shot**

Run: `cd frontend && npm run dev`, navigate to `/trends`. Adjust `FACADE_ANCHOR` (RecoveryFacade.tsx) and the `/trends` `pos`/`look` together until: the full tower height is framed, windows are legible, and the planet's limb + atmosphere remain visible at an edge (keeps it "the same world", vision §5 restraint). Use the dev `window.__orbital` camera in the console to read back good values. Record the final numbers in the `FACADE_ANCHOR` comment.

Expected end state: entering `/trends` flies the camera down to the facade (damped, interruption-safe — free from the existing rig); Esc / leaving pulls back to orbit.

- [ ] **Step 4: Verify reduced-motion**

In the browser devtools, emulate `prefers-reduced-motion: reduce`, reload, go to `/trends`.
Expected: the camera snaps to the facade (cameraRig already handles this); flicker is the only motion and is subtle — acceptable. (Flicker fully stops on low quality via Task 4/5.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/orbital/cameraRig.tsx frontend/src/orbital/scene/RecoveryFacade.tsx frontend/src/orbital/index.tsx frontend/src/pages/Trends.tsx
git commit -m "feat(orbital): /trends descent camera target, facade as hero (drop glass console)"
```

---

## Task 8: Full-suite check + final verification

**Files:** none (verification only).

- [ ] **Step 1: Run the whole test suite**

Run: `cd frontend && npx vitest run`
Expected: all tests pass, including the new `palette.test.ts` and `yearFacade.test.ts`.

- [ ] **Step 2: Type-check + lint**

Run: `cd frontend && npx tsc --noEmit && npm run lint` (repo uses `eslint .`)
Expected: no new errors in the files this plan created/modified. Fix any unused-import warnings introduced by removing the `/trends` console page (Task 7 Step 2).

- [ ] **Step 3: End-to-end visual pass on `/trends`**

Run the app. Confirm against the spec's guardrails:
- Descent frames the facade, planet limb in shot.
- Windows colored by recovery scale (neon-graded); empty days dim.
- Ghost-baseline reads behind the lit face; hover shows exact `recovery · vs baseline · delta`.
- Leaving `/trends` fades the facade and pulls the camera back.
- Low quality (force `qualityAtom = "low"` or trip `PerfMonitor`) drops scanline + flicker; still renders.

- [ ] **Step 4: Final commit (if any tuning remains)**

```bash
git add -A
git commit -m "chore(orbital): Spec 2 city foundations + recovery-year facade complete"
```

---

## Notes for the implementer

- **Every new `three` import** comes from `three/webgpu` (aliased `THREE`) or `three/tsl`. Never the bare `three` package — the renderer is `WebGPURenderer`.
- **The shared material is the point.** `createLuminousMaterial` must stay generic (no recovery-specific logic) so Spec 3 (Sleep Canyon) and later towers/EQ reuse it. Recovery-specific mapping lives in `palette.ts` + `RecoveryFacade.tsx` only.
- **Match `SleepDescent.tsx`** for any pattern question (fade gating, dispose, unstick-on-leave) — it is the closest shipped sibling.
- **`yearRecoveryAtom`** already exists in `frontend/src/atoms/api.ts` and returns `{ days: DailyMetrics[] }`; `DailyMetrics` has `day: string` and `recovery: number | null`.
```
