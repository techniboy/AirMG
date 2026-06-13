# Orbital — Living Earth (Spec 1)

> **Status:** Approved 2026-06-13 via visual brainstorming. First implementable spec of the program in `2026-06-13-orbital-data-city-vision.md`. Independent of the Data City work — ships on its own.

> **Scope:** Three changes to the existing orbital scene, no new routes, no backend. (1) Aurora speaks recovery, not HRV-hue. (2) The planet becomes a real textured Earth. (3) A new ambient time-of-day layer lights the scene from the user's real local clock. Weather was considered and **cut**.

> **Touched files:** `frontend/src/orbital/worldState.ts` (+ `worldState.test.ts`), `scene/Aurora.tsx`, `scene/Planet.tsx`, a new `solarClock.ts`, `index.tsx` (wire the clock), and `frontend/public/orbital/` for textures. Backend untouched (`uv run pytest` unchanged).

---

## Feature 1 — Aurora → recovery color

**Today** (`scene/Aurora.tsx`, `worldState.ts`): aurora color is HRV-driven (`auroraVioletShift`, teal↔violet) and brightness is HRV-driven (`auroraIntensity = clamp01(0.5 + hrvZ/6)`).

**Change:** color follows the **recovery band**; brightness stays HRV.

- `worldState.ts`:
  - **Remove** `auroraVioletShift` from `WorldState`, `DORMANT`, and `computeWorldState`.
  - **Add** `recovery01: number` (0..1) to `WorldState`. `computeWorldState`: `recovery01 = clamp01(nz(recovery, 50) / 100)`. `DORMANT.recovery01 = 0`.
  - Keep `auroraIntensity` exactly as is (HRV z).
- `scene/Aurora.tsx`:
  - Replace the `violetShift` uniform with a `recovery01` uniform (damped from `world.recovery01`, same 2.2 smoothTime).
  - Replace the two hardcoded color mixes (`baseColor`, `tipColor`) with a **continuous lerp across the 5-stop recovery palette**:
    `#FF4F73 (0) → #F5A623 (.25) → #E8C24B (.5) → #18C98B (.75) → #2FE6A8 (1)`.
    Implement as a small TSL piecewise `mix` chain (or a 1×5 gradient lookup) keyed on `recovery01`. The tip stays a touch brighter/cooler than the base (preserve the existing base-vs-tip separation for depth), but both ride the same recovery hue.
  - Real auroras span exactly this red→green range, so the mapping is physically plausible as well as legible.

**Why:** recovery is the headline (color), HRV is the engine that brightens it. Two coherent layers, one instrument. See `[[recovery-aurora-mapping]]`.

## Feature 2 — Planet → real Earth (fidelity tier "Core")

**Today** (`scene/Planet.tsx`): fully procedural — fbm continents, recovery *generates* the lush↔ashen palette, ocean glint masked by the noise `landMask`, amber city dots on the night side.

**Change:** real Earth textures; recovery becomes a **grade** over them.

- **Assets** (NASA, public domain — Blue Marble / Black Marble), 2k, in `frontend/public/orbital/`, lazy (orbital chunk already lazy-loads):
  - `earth-day.jpg` — daytime albedo (continents/ocean).
  - `earth-night.jpg` — Black Marble night lights.
  - `earth-mask.jpg` — land/sea mask (single channel; white = land).
  - No cloud texture, no normal/bump (deferred — see Out of scope). Budget ~2 MB total; downscale if needed.
  - Load with three's `TextureLoader` inside the lazy scene; set `colorSpace = SRGBColorSpace` on day/night; mask stays linear. Dispose on unmount alongside the material.
- **Surface material** (`buildSurfaceMaterial`): sample `earth-day` by `uv()` as the base albedo instead of the fbm palette. Then:
  - **Recovery grade** keeps the existing uniforms: `surfaceSaturation` lerps the sampled albedo between full-color (recovered) and a desaturated/dimmed version (depleted); `desaturate` (sync-stale) still washes toward luminance. Land/ocean are no longer generated — recovery only grades.
  - **Ocean glint** uses `earth-mask` (sea = `oneMinus(land)`) instead of the procedural `landMask`. Keep the existing specular/fresnel math.
  - **Night lights** = sample `earth-night`, gated by the existing `night` term and modulated by `cityCalm` (steady vs flicker) — replaces the procedural `cluster/dots`. City lights now sit on real geography.
  - **Ice/poles** can stay procedural (cheap) or read from the day texture's existing white — keep procedural caps, they read fine.
- **Storms** (`buildStorm`): unchanged. Recovery-driven procedural swirls ride on top of the real Earth.
- **Lighting direction:** replace the module-const `SUN_DIR` with a `sunDir` **uniform** (Feature 3 drives it). Default value = today's `SUN_POSITION.normalize()` so nothing changes until the clock layer is wired.

## Feature 3 — Time-of-day (the ambient layer)

The planet shades itself in world space against `sunDir` (now a uniform) — it does **not** use the scene's directional light. That makes the terminator cheap to move: rotate `sunDir`.

- **Source — `frontend/src/orbital/solarClock.ts`** (new), deliberately separate from `worldStateAtom` (that atom is pure-from-metrics; this is clock-based and ticks):
  - A hook `useSolarClock()` (or a jotai atom refreshed by an interval) returning `{ sunDir: THREE.Vector3, warmth: number }` where `warmth ∈ 0 (deep night) .. 1 (midday)`.
  - Derive from `new Date()` **local time**: a `dayFraction = (hours*60+minutes)/1440`. Map to an **hour-angle** rotation of `sunDir` about the planet's polar (Y) axis so the terminator sits at the user's local solar time. Keep sun **elevation modest and fixed** (ignore season/latitude for v1).
  - `warmth` from the same `dayFraction`: low/cool near local midnight, rising to 1 at local noon (smooth, e.g. a raised-cosine).
  - Tick every ~60 s (cheap; the damp smooths it). 
  - **Fixture override:** `?timeFixture=dawn|noon|dusk|night` (mirror the existing `?worldFixture=` pattern in `worldState.ts`) so screenshots are deterministic.
- **Wiring:**
  - `Planet.tsx`: damp the material's `sunDir` uniform toward `solarClock.sunDir` (slow, ~3 s smoothTime so dawn creeps in). Add a `warmth` uniform: tint the day-side light term warm at low warmth (dawn/dusk amber) → neutral white near noon, and pull overall day brightness down at night. Reuse the existing `duskBand` amber as the warm end.
  - Optionally tint the `directionalLight` color in `Star.tsx` by warmth too, for any standard-lit bodies (moon/satellite) — low-risk, nice-to-have.
- **Coherence note (tuning item, not a blocker):** the visible strain-star stays fixed at `SUN_POSITION` (camera rig + composition untouched). The planet's lighting `sunDir` is intentionally decoupled from it — the star is a stylized body, and the planet already never used it as its light source. To avoid a jarring "sun here, terminator there" read, **constrain the `sunDir` hour-angle swing** to a range that keeps the lit crescent broadly consistent with the star's on-screen azimuth; validate in polish screenshots at the four `timeFixture` values. If a wider swing reads wrong, narrow the range — warmth + a partial terminator sweep is enough to sell time-of-day without breaking the hero composition.

## Planet rotation — slow drift (resolved)

Today RHR drives `rotationSpeed` at ~0.01–0.03 rad/s (≈1 turn / 5 min — visibly fast). With the terminator pinned to the clock that would make "it's dawn" unreadable.

**Resolution (user-approved):** keep the RHR→rotation mapping but **scale it down to a gentle decorative drift** (target ≈ 1 turn / hour or slower; pick a constant so the fastest RHR still reads as "barely turning"). `sunDir` is recomputed from the real clock each frame, so the terminator stays at local time while the continents creep. Real Earth behavior: sun fixed, planet spins slowly.

## Tests

- `worldState.test.ts`:
  - **Remove** the `auroraVioletShift` assertions.
  - **Replace** with `recovery01` assertions: high recovery → `recovery01` near 1, low → near 0, null recovery → neutral (0.5) and never NaN.
  - Keep the `auroraIntensity` (HRV) and other existing assertions intact.
- No new test harness for shaders/textures — validate visually via the `?worldFixture` × `?timeFixture` screenshot matrix (Playwright MCP), consistent with the existing orbital polish process.

## Out of scope (explicit)

- **Live weather** — cut entirely.
- **Cloud texture layer** and **normal/bump relief** — deferred (tier B/C); storms stay procedural, terminator relief not simulated.
- **Camera orbit following the sun** — not in v1; camera rig unchanged.
- **Geolocation / per-user lat-lon precision** — terminator uses local-time hour-angle only; seasonal axial tilt and latitude-correct sun elevation deferred.
- **The Data City** — separate program (see vision doc); this spec only touches the existing planet/aurora/lighting.

## Verification gate

`cd frontend && npx tsc -b && npx vite build && npx vitest run` all green; backend untouched. Visual: four `timeFixture` states × three `worldFixture` states render coherently — recovery-tinted aurora, real Earth with recovery grade, terminator + warmth at the right local time, slow drift.
