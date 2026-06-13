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

## 3. The city is the visual language (a kit of parts, not a building catalog)

The whole city is the vocabulary — not just buildings and windows. **Structures, facades, streets, traffic, bridges, rail, transit lines, aerial/plan views, signage, beacons, harbor, power grid, parks** are all viz primitives. The job is to map each visualization to the city element whose **real-world behavior matches the data's behavior** — and *not* to overfit everything into towers + windows.

The discipline that keeps "visualize *everything*" coherent is **not** a frozen list of forms. It's a shared rendering system + a selection principle:

- **Shared system** → one family of emissive "luminous" materials (addressable cells, HCF grade, bloom, subtle scanline, flicker), one palette, one post chain, one descent. Any new element inherits these, so coherence holds even as the element vocabulary grows.
- **Selection principle** → match the data's *shape/topology* to a city element's *nature*. The element vocabulary is **open**; add elements when a data type genuinely fits one better.

**Selection heuristic (data behavior → city element):**

| Data behaves like… | …render as the city element that behaves like that |
|---|---|
| Magnitude / accumulation | structure **height / mass** (towers, spires) |
| Dense grid / calendar / cells | a **facade** of windows |
| Continuous flow / throughput / cadence | **street traffic**, expressway light-trails |
| A sequence you move through over time | a **journey / route** through the city (the Sleep Canyon is one instance) |
| Relationship / connection / coupling | **bridges, rail, skybridges** between districts |
| Density / distribution over an area | an **aerial / plan view**, block brightness |
| Category / domain | a **district / zone** with its own character (harbor, power grid, park…) |
| Headline number / status | **signage / billboards**, rooftop **beacons** |
| Comparison (A vs B) | **paired / twin** structures |
| Deviation from normal | a **ghost zoning envelope** behind any element (universal overlay) |
| Cycle / rhythm | the **day-night / tides / transit loops** of the city |

## 4. Worked examples (illustrative, NOT a closed mapping)

Grounded in `frontend/src/lib/types.ts` + the `/api` surface. These are first-pass fits to validate the heuristic — expect them to evolve, and expect new elements to appear as we go.

| Data type (real) | Source | First-pass city element |
|---|---|---|
| Recovery %, day strain (headline) | `/api/today` | Billboard / signage |
| Recovery year (365-day) | `/api/trends`, `YearHeatStrip` | Facade heatmap *(Spec 2 first slice)* |
| Per-metric multi-day trends | `/api/sparklines`, `/api/trends` | Skyline / a single data spire |
| Hypnogram (stage segments) | `/api/sleep/`, `StageSegment[]` | **Sleep Canyon** journey (see §5) |
| Stage minutes | `DailyMetrics.*_minutes` | Stacked cross-section |
| Intraday HR trace | `/api/hr-trend` | EQ tower / a light-trail run |
| Step cadence / flow | `/api/sparklines` | Street traffic |
| HR zone minutes | `/api/workouts/summary` | EQ stacked |
| Workouts + sport breakdown | `/api/workouts`, `SportBreakdown` | Skyline (one structure / sport) + beacons |
| Correlations | `/api/insights`, `CorrelationResult` | Skybridges / rail between districts |
| Behavior effects | `/api/insights/behaviours` | Twin structures |
| Baselines | `/api/baselines` | Ghost zoning *(overlay on all)* |
| Readiness flags | `/api/readiness` | Rooftop beacons |
| Health age | `/api/health-age` | Monument / district age |
| ACWR ratio | `ReadinessResult.acwr` | Balance / harbor-load motif |

**Not everything is a structure, and not everything is a viz.** Coach / Insights / Journal *text* (`/api/coach`, recommendations, journal entries) stays text — neon-marquee styling, never forced into geometry. Honest viz includes knowing when not to abstract.

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

- **Shared material family, open element kit** → coherence comes from the rendering system + aesthetic + descent, not from freezing the catalog. New city elements are welcome; they just inherit the shared look.
- **Honest viz** → geometry proportional to real values; hover/tap always exposes the exact number; no chartjunk.
- **Accessibility** → every diorama keeps the orbital theme's a11y mirrors (visually-hidden DOM readouts, reduced-motion paths, keyboard nav) — see the shipped HUD pattern.
- **Perf** → respect the existing perf-degrade ratchet, visibility pause, and DPR clamps. The city must degrade gracefully on low-end GPUs (the descent can simplify geometry/skip scanline first).

## 8. Phasing (each phase = its own spec → plan → build)

1. **Spec 1 — Living Earth** *(designed, ready: `2026-06-13-orbital-living-earth-design.md`)*. Aurora → recovery color; planet → real Earth (tier A); time-of-day lighting. Independent of the city; ships first as a coherent win.
2. **Spec 2 — City foundations + first slice.** The descent transition (orbit → city) + the one luminous-facade material + the HCF palette tokens + the **J** ghost-baseline overlay + **Recovery year → Facade (A)** end-to-end. Proves the whole system on the simplest geometry.
3. **Spec 3 — Sleep Canyon (B′).** The hero showcase, once the material/descent system is proven.
4. **Spec 4+ — Roll out the rest of the city** page by page, choosing the fitting element per data type (per §3 heuristic): trends → skyline/spire, HR/zones → EQ, cadence → street traffic, headlines → signage, correlations → bridges/rail, behaviors → twin structures, readiness → beacons, health age → monument, plus any new elements the data calls for.

Order within 4+ to be decided per value/effort when we get there.
