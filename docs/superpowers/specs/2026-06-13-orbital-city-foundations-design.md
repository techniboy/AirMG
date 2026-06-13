# Orbital Data City — Spec 2: City Foundations + Recovery-year Facade

> **Status:** Approved (visual brainstorm, 2026-06-13). Implementation spec for **Spec 2** of the Data City program.
>
> **North star:** `docs/superpowers/specs/2026-06-13-orbital-data-city-vision.md` (§2 descent, §3 shared system + selection heuristic, §6 HCF aesthetic, §7 guardrails, §8 phasing).
>
> **Prior art / patterns to match:** the shipped orbital theme — `frontend/src/orbital/`. Specifically: scene components take an `active: boolean` prop and fade via a damped `master` opacity uniform (`SleepDescent.tsx`, `RecoveryRings.tsx`); one-draw geometry with per-vertex/per-instance color; TSL `MeshBasicNodeMaterial`; `maath/easing` `damp`/`damp3`; the `cameraRig.tsx` `CAMERA_TARGETS` map; the native PostProcessing chain in `Effects.tsx`; the perf ratchet (`qualityAtom`/`PerfMonitor`); reduced-motion snap; a11y SR mirrors (`.orbital-sr-only`). Night-side city lights + low-frequency flicker already exist in `Planet.tsx` (driven by `cityCalm` + `time`) — the facade material echoes that idiom so it reads as the same world.

## 1. Goal

Replace the flat recharts recovery-year heatmap (`YearHeatStrip` on `/trends`) with the first end-to-end slice of the Data City: **descend from orbit to a luminous tower facade whose 365 windows encode a year of recovery.** This slice exists to prove the whole system on the simplest geometry, so it must ship four reusable foundations alongside it:

1. **The descent transition** (orbit → city), built on the existing camera rig.
2. **One shared luminous-facade material** (HCF palette) every future city element inherits.
3. **The HCF palette tokens + neon-grade helper.**
4. **The ghost-baseline overlay (J)** — the universal "deviation from normal" mechanic.

Non-goal: migrating the rest of `/trends` (per-metric trends, range selector). For this slice, `/trends` becomes the facade descent (the flat recharts console panel is dropped there, since a frosted glass panel would occlude the interactive hero — vision §2: the descent *replaces* the flat console-panel route). The remaining trend charts return as their own city elements in Spec 4+. This spec only adds the recovery-year facade.

## 2. Decisions locked in brainstorm

| Fork | Decision |
|---|---|
| Entry point | Descend from `/trends`. Spec 2 = recovery-year facade only; other Trends charts untouched. |
| Facade geometry | **Flat** emissive tower face (not relief). 7 columns (Mon–Sun) × ~53 rows (weeks), weeks climb the tower, **today = rooftop**. |
| Window encoding | Recovery 5-bucket color → neon-graded; brightness + flicker carry liveliness. Magnitude lives in color, not depth. |
| Ghost-baseline (J) | **Both:** a persistent faint ghost (dim baseline-colored duplicate facade, offset behind) **and** hover always exposes the exact actual-vs-baseline number + delta. Deviation-recolor toggle deferred. |
| Baseline source | No server-side recovery baseline. Compute a **rolling ~90-day personal mean** client-side, per day. |
| Descent mechanics | Reuse `cameraRig` (`CAMERA_TARGETS["/trends"]`) + `active`-driven fade. No bespoke title sequence (defer drama to Spec 3 Sleep Canyon once the rig is proven). |
| Palette location | `orbital/palette.ts` TS module (consts + `neonGrade`). No CSS vars this slice. |

## 3. Architecture (units, interfaces, dependencies)

Six focused units. Each is independently understandable and (where it has logic) testable.

### 3.1 `orbital/palette.ts` — HCF tokens + grade helpers
Pure module. No three import beyond `THREE.Color`.
- **Exports:** the HCF accent constants — amber `#ffb347`, magenta `#ff2d78`, cyan `#16d8e8`, indigo `#8a4dff`, phosphor-green (pick one, e.g. `#7dff9b`).
- `neonGrade(hex: string): THREE.Color` — lifts saturation + floor on lightness so an additive/bloomed color clears the post chain. Reuse the exact HSL-lift idiom already in `SleepDescent.tsx`'s `STAGE_GLOW` (`s*1.1`, `l≥0.55`), extracted here so it stops being copy-pasted.
- `recoveryNeon(value: number): THREE.Color` — maps a recovery score (0–100) through the existing 5-bucket scale (the same thresholds/colors as `YearHeatStrip.defaultRecoveryColor`: `#FF4F73 / #F5A623 / #E8C24B / #18C98B / #2FE6A8`) then `neonGrade`. Single source of truth for "recovery as a neon color."
- **Depends on:** nothing project-specific. **Used by:** `RecoveryFacade`, future elements.

### 3.2 `orbital/yearFacade.ts` — data shaping + baseline
Pure module (no three, no React). The honest-data layer.
- **Input:** the `yearRecoveryAtom` payload (`{ days: DailyMetrics[] }`, already fetched in `index.tsx`).
- **Output:** `FacadeCell[]` of length ≤365, each `{ col: 0–6, row: number, day: string, value: number | null, baseline: number | null, delta: number | null }`. `col` = ISO weekday (Mon=0…Sun=6) → the 7 window columns. `row` = week index, incrementing once per week → the tower floors. Today gets the **highest `row`** so it renders at the rooftop. (This is `YearHeatStrip`'s layout transposed: there weeks run horizontally; here weeks climb vertically.)
- **Baseline:** for each day, the mean of the trailing 90 days of non-null recovery (inclusive window, require ≥ a small minimum, else `null`). `delta = value - baseline`.
- **Plus:** a tiny summary `{ mean, count, todayCol, todayRow }` for camera framing / HUD.
- **Test:** `yearFacade.test.ts` — weekday→col/row layout (incl. today at rooftop), rolling-90 baseline math (window edges, null handling), delta sign. Vitest, matching the existing `*.test.ts` style.

### 3.3 `orbital/scene/facadeMaterial.ts` — the shared luminous material (foundation)
The reusable heart of the spec. A factory, not a component.
- `createLuminousMaterial(opts): { material, uniforms }` returning a TSL `MeshBasicNodeMaterial` configured for instanced, additively-blended emissive cells:
  - per-instance color via `instancedBufferAttribute` / `instanceColor`,
  - a `master` opacity uniform (damped externally for fade-in),
  - **subtle scanline** (a `uv().y`-based `sin` band) and **low-frequency flicker** (`time`-driven, echoing `Planet.tsx`'s city flicker) — both amplitude-controlled by uniforms,
  - additive blending, `depthWrite:false`, `transparent:true` (same as the shipped additive layers).
- `opts` lets callers dial scanline/flicker amplitude and a brightness multiplier (ghost passes near-zero scanline + dimmer).
- **Quality gate:** scanline + flicker amplitudes drop to 0 on `quality === "low"` (caller passes quality, or exposes a uniform the scene sets). One material path, cheaper on low-end.
- **Why a factory:** Spec 3+ (Sleep Canyon, towers, EQ) call the same factory so the city stays one material family. This is the "shared rendering system" of vision §3.

### 3.4 `orbital/scene/RecoveryFacade.tsx` — the diorama
Mirrors `SleepDescent.tsx` structure (props, fade, hover, dispose, reduced-motion).
- **Props:** `{ cells: FacadeCell[] | null; summary; active: boolean; quality }`.
- **Geometry:** one `InstancedMesh` (small quad, 365 instances) for the lit facade; per-instance color = `recoveryNeon(value)` (null days → dim recessed neutral). A **second** `InstancedMesh` for the ghost, per-instance color = `recoveryNeon(baseline)`, positioned slightly *behind* (−Z in facade-local space) and scaled up a touch so its edges read as a zoning envelope around the lit face; lower brightness via its material opts.
- **Material:** both meshes use `createLuminousMaterial` (ghost with reduced scanline/flicker + brightness).
- **Placement:** a facade-local group anchored off the planet **night-side** (away from `SUN_DIR`), sized/oriented so the `/trends` camera target frames it cleanly — chosen the same empirical way `SleepDescent`'s arc was (project candidates through the camera; document the chosen transform in a comment). Tower face roughly upright, 7 windows wide, weeks climbing.
- **Fade:** `master` uniform damped `active ? 1 : 0` (`maath` `damp`), group `visible` gated on `active || master > ε`, exactly like `SleepDescent`.
- **Hover:** raycast `instanceId` on the lit mesh → `Html` chip near the window: `Tue Jun 10 · 72% · vs 64% normal · +8`. Reuse `.orbital-chip` styling. Unstick chip on route-leave (the `prevActive` pattern from `SleepDescent`).
- **Dispose:** geometries + materials disposed on rebuild (day/data change) and unmount.

### 3.5 `cameraRig.tsx` — add the descent target
- Add `"/trends"` to `CAMERA_TARGETS`: a position diving close to the planet night-side, looking at the facade anchor. Tuned so the facade fills frame and the planet limb + atmosphere stay in shot (keeps it in the same world, not a black void). Everything else (damping, parallax, reduced-motion snap) already handles the transition for free.

### 3.6 `index.tsx` — wiring
- Read `yearRecoveryAtom` (already imported pattern via `useAtomValue`), memoize `asYearFacade(data)` (like the existing `sleepTrack`/`ringMetrics` memos).
- Mount `<RecoveryFacade cells={...} summary={...} active={location.pathname === "/trends"} quality={quality} />` inside the Canvas, in the planet group's vicinity.
- Remove `/trends` from `CONSOLE_PAGES` so the frosted `ConsolePanel` no longer mounts there (it would occlude the facade and block hover). The facade is the `/trends` view. Delete the now-redundant `YearHeatStrip` card from `Trends.tsx`. The recharts Trends page returns as city elements in Spec 4+.
- a11y: add an SR-only control/mirror for the facade in `.orbital-sr-nav`, and a visually-hidden summary readout (year mean, today's recovery vs baseline) so the data is available without the canvas.

## 4. Data flow

```
yearRecoveryAtom ({days:[{day,recovery}]})         baselinesAtom (unused here)
        │
        ▼  asYearFacade()  (orbital/yearFacade.ts)
FacadeCell[] {col,row,value,baseline(rolling-90),delta} + summary
        │  memo in index.tsx
        ▼
RecoveryFacade (active = pathname==='/trends', quality)
   ├─ lit InstancedMesh   ← recoveryNeon(value)   ┐
   ├─ ghost InstancedMesh ← recoveryNeon(baseline)├─ createLuminousMaterial (shared)
   └─ hover chip (instanceId → date/value/baseline/delta)
        ▲
cameraRig CAMERA_TARGETS['/trends'] dives the camera to frame it
```

## 5. Aesthetic fit ("beautifully crafted, same world")

- **Reuse, don't invent:** window colors are the existing recovery scale, only neon-graded. HCF accents (cyan/amber/magenta/indigo/phosphor) are the ghost frame, scanline tint, and chip accents — not the primary data color.
- **Same material idioms as the planet:** additive emissive + bloom-clearing brightness + low-frequency `time` flicker (the planet's night-city flicker), so the facade looks like the same city lights seen up close.
- **Restraint (vision §6):** black sky, the planet limb + atmosphere still framing the shot, one hero structure, haze/bloom for depth. Not Blade Runner clutter.
- **Lets the post chain do the work:** the existing `Effects.tsx` bloom/grain/CA/vignette is what makes emissive windows glow — lean on it (more bloom when descended is acceptable), don't build a new pipeline.

## 6. Guardrails (vision §7)

- **Honest viz:** hover always exposes exact recovery, baseline, and delta; null days render as visibly empty (not faked). Color is the only encoding, mapped through the canonical scale.
- **Accessibility:** SR-only mirror + visually-hidden summary; reduced-motion snaps the descent (camera rig already does this) and freezes flicker/scanline; chip is keyboard-reachable via the SR controls.
- **Perf:** two instanced draws total; scanline + flicker amplitudes collapse to 0 on `quality === "low"`; group skips raycast/render when inactive and faded out; geometries/materials disposed. Respects the existing perf ratchet and visibility pause.

## 7. Out of scope (explicit)

- Other `/trends` charts → Spec 4+.
- Relief/extruded facade, datum-plane → rejected (flat chosen).
- Deviation-recolor toggle → deferred (J ships as ghost + hover number).
- Bespoke title-sequence descent → deferred to Spec 3.
- CSS-var palette tokens → add only when HUD chrome needs them.

## 8. Build order (for the plan)

1. `palette.ts` (+ no test needed — trivial, but `recoveryNeon` bucket boundaries get one assert).
2. `yearFacade.ts` + `yearFacade.test.ts` (pure, TDD).
3. `facadeMaterial.ts` (shared material factory).
4. `RecoveryFacade.tsx` (diorama; flat lit facade first, then ghost, then hover).
5. `cameraRig` `/trends` target + `index.tsx` wiring + a11y.
6. Verify in-app (Playwright `__orbital` hook + `?worldFixture` / a year fixture): descent frames the facade, windows colored, ghost reads, hover number correct, reduced-motion + low-quality paths.
