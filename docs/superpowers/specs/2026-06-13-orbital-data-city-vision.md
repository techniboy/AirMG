# Orbital — Living Earth & the Data City (North-Star Vision)

> **Status:** Approved creative direction. This is the reference document for a multi-spec program. It is NOT itself an implementation spec — each phase below gets its own spec → plan → build cycle. Decisions here were validated through visual brainstorming on 2026-06-13.

> **Prior art:** Builds on the shipped orbital theme — `docs/superpowers/specs/2026-06-12-orbital-theme-design.md` and `frontend/src/orbital/` (Planet, Aurora, Star, MoonSat, camera rig, HUD, dioramas, perf system). Everything here is WebGL 3D at that same fidelity (three/WebGPU + TSL node materials, the native PostProcessing bloom/grain/CA/vignette chain, `maath` damping, perf-degrade + reduced-motion). Nothing here is a flat DOM chart.

---

## 1. The core principle: two layers, never mixed

The orbital world separates cleanly into two layers that must never fight for the same visual channel:

- **Body layer** (your physiology) — already built. Recovery → planet surface/storms/atmosphere; HRV → aurora; strain → star corona; sleep → moon; steps → satellite. *This is you.*
- **Ambient layer** (your environment) — your real **local clock** lights the scene (time-of-day). *This is the world around you.* (Live weather was explicitly considered and **cut** — it muddied the body metaphor and added a data dependency for little payoff.)

Keeping these separate is why time-of-day can light the planet without ever contradicting "the world is your body."

## 2. The thesis: the city is the visualization canvas

We currently render generic 2D charts (recharts) inside console pages. The groundbreaking move: **your data becomes a luminous night city.** The Earth already carries city lights on its night side (shipped). Those lights *are* your data. Drilling into a metric = **descending** from orbit through haze to that city's skyline, where buildings encode the numbers and windows are the cells.

**One zoom axis = increasing data resolution — "Powers of Ten" for your body:**

```
ORBIT            DISTRICT          BUILDING         WINDOW
you as a world → a metric domain → one chart    →  one data point
```

The descent replaces the flat console-panel route change. Console pages become street-level / orbiting vantages over a 3D diorama. The dive itself is a Halt-and-Catch-Fire title-sequence moment.

## 3. The closed vocabulary (one material, many forms)

The discipline that makes "visualize *everything*" achievable without sprawl: a **single emissive "luminous-facade" material** (grid of addressable cells, HCF grade, bloom, subtle scanline, flicker) applied to a **finite set of geometries**. Every visualization is one of these forms — no ad-hoc shapes.

| Form | Name | Geometry | Reads as |
|------|------|----------|----------|
| **A** | Facade heatmap | flat windowed grid on a tower face | calendar / dense date data |
| **B** | Skyline bars | row of extruded towers | trend / bar chart over time |
| **B′** | **Sleep Canyon** *(hero)* | flythrough perspective canyon | the hypnogram (see §5) |
| **C** | EQ tower | columns of stacked cells | intraday trace / zone minutes |
| **D** | Light-stream traffic | animated light-trails on streets | continuous flow / cadence |
| **E** | Cross-section / Sleep Core | cutaway tower, floors = bands | stacked stages, orbited |
| **F** | Neon billboard | Shibuya signage panel + CountUp | headline single number |
| **G** | Data spire | one sculptural building, setbacks = curve | one bold trend |
| **H** | Sky-bridges | glowing connectors between towers | correlations (r, lag, sign) |
| **I** | Twin towers | paired towers, height delta | behavior effects (with vs without) |
| **J** | Ghost zoning | dashed baseline envelope behind any form | baselines (mean ± spread) — **universal overlay** |
| **K** | Status beacons | rooftop signal lights | readiness flags (good/watch/bad) |
| — | Monument | single weathered structure | health age |
| — | Balance gauge | billboard ratio | ACWR |

## 4. Data → form mapping (grounded in `frontend/src/lib/types.ts` + the `/api` surface)

| Data type (real) | Source | Form |
|---|---|---|
| Recovery %, day strain (headline) | `/api/today` | **F** Billboard |
| Recovery year (365-day) | `/api/trends`, `YearHeatStrip` | **A** Facade |
| Per-metric multi-day trends (HRV, RHR, resp, SpO₂, steps, cal…) | `/api/sparklines`, `/api/trends` | **B** Skyline / **G** Spire |
| Hypnogram (stage segments over a night) | `/api/sleep/`, `StageSegment[]` | **B′** Sleep Canyon |
| Stage minutes (deep/rem/light/wake) | `DailyMetrics.*_minutes` | **E** stacked floors |
| Intraday HR trace | `/api/hr-trend`, `HRTrendData` | **C** EQ tower |
| Step cadence / continuous flow | `/api/sparklines` | **D** Light-streams |
| HR zone minutes | `/api/workouts/summary`, `hr_zones` | **C** EQ stacked |
| Workouts + sport breakdown | `/api/workouts`, `SportBreakdown` | **B** Skyline (tower/sport) + beacons |
| Correlations | `/api/insights`, `CorrelationResult` | **H** Sky-bridges |
| Behavior effects | `/api/insights/behaviours`, `BehaviorEffect` | **I** Twin towers |
| Baselines | `/api/baselines`, `BaselineInfo` | **J** Ghost zoning *(overlay on all)* |
| Readiness flags | `/api/readiness`, `ReadinessSignal` | **K** Beacons |
| Health age | `/api/health-age` | Monument |
| ACWR ratio | `ReadinessResult.acwr` | Balance gauge |

**Not everything is a building.** Coach / Insights / Journal *text* (`/api/coach`, recommendations, journal entries) stays text — given neon-marquee styling, never forced into geometry. Honest viz includes knowing when not to abstract.

## 5. The hypnogram — the Sleep Canyon (hero diorama)

A hypnogram is time × stage × duration. Bars convey little; instead the user **travels the night**:

- **Time** recedes toward a dawn glow (the wake point / vanishing point).
- **Sleep depth is spatial** — the avenue sinks into dark monolithic **vaults** (deep), rises through blue mid-blocks (light), blooms into tall cyan dream-**spires** (REM, where the neon concentrates), with magenta **beacon shafts** for micro-awakenings. Wake gaps read as breaks in the canyon.
- **Stage = architectural character**, not just color/height — each stage has a distinct building form, so the night reads even in silhouette.
- The ~4–5 sleep **cycles** emerge as the canyon's rolling topography as you glide.
- **Interactive & honest:** scrub = fly the camera through the night; hover any structure → exact clock time · stage · duration. Geometry is proportional to real durations.
- Reuses `sleepStageColor` (deep `#2C3A7A`, light `#5C6FB1`, rem `#5BE0C7`, wake `#E0476B`) and the existing stage decimation from `SleepDescent.tsx`.

Alternates considered and parked: **Sleep Core** (orbited cutaway tower, ribbon climbs stage-floors over the night — the descent-track stood upright) and **Cycle Towers** (each ~90-min cycle = a stacked tower). Canyon chosen as primary.

## 6. Aesthetic: Halt and Catch Fire, tastefully

- **Palette discipline — reuse, don't invent.** The data colors already shipped (recovery scale, strain scale, `HR_ZONE_COLORS`, `sleepStageColor`) get a **neon-emissive grade + bloom + scanline**, plus a small HCF accent set: amber `#ffb347`, magenta `#ff2d78`, cyan `#16d8e8`, indigo `#8a4dff`, phosphor-green. HCF = grade + glow on existing semantic colors, not a new arbitrary palette.
- **References:** Tokyo / Chongqing / NYC at night — stacked multi-level cities, expressway light-trails, Shibuya signage, Chongqing fog for depth.
- **Restraint.** Black sky, negative space, a few hero structures, atmospheric haze for depth. Not Blade Runner clutter — generational, not gaudy.
- **Reuse the post chain.** The orbital `Effects.tsx` (bloom/grain/CA/vignette) already exists; the city leans into it (more bloom, optional scanline) when descended rather than building a new pipeline.

## 7. Taste & integrity guardrails

- **One material, many forms** → coherence + one build, not eleven.
- **Honest viz** → geometry proportional to real values; hover/tap always exposes the exact number; no chartjunk.
- **Accessibility** → every diorama keeps the orbital theme's a11y mirrors (visually-hidden DOM readouts, reduced-motion paths, keyboard nav) — see the shipped HUD pattern.
- **Perf** → respect the existing perf-degrade ratchet, visibility pause, and DPR clamps. The city must degrade gracefully on low-end GPUs (the descent can simplify geometry/skip scanline first).

## 8. Phasing (each phase = its own spec → plan → build)

1. **Spec 1 — Living Earth** *(designed, ready: `2026-06-13-orbital-living-earth-design.md`)*. Aurora → recovery color; planet → real Earth (tier A); time-of-day lighting. Independent of the city; ships first as a coherent win.
2. **Spec 2 — City foundations + first slice.** The descent transition (orbit → city) + the one luminous-facade material + the HCF palette tokens + the **J** ghost-baseline overlay + **Recovery year → Facade (A)** end-to-end. Proves the whole system on the simplest geometry.
3. **Spec 3 — Sleep Canyon (B′).** The hero showcase, once the material/descent system is proven.
4. **Spec 4+ — Roll out remaining forms** page by page: Skyline/Spire (trends), EQ (HR/zones), Light-streams (cadence), Billboard (headlines), Sky-bridges (correlations), Twin towers (behaviors), Beacons (readiness), Monument (health age).

Order within 4+ to be decided per value/effort when we get there.
