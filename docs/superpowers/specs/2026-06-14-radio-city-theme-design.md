# Radio City — theme design

**Date:** 2026-06-14
**Status:** approved design, ready for implementation plan
**Related:** `docs/mockups/hacf-viz-gallery.html` (locked viz vocabulary), brainstorm mocks `.superpowers/brainstorm/*/content/direction-A-v10.html` (final shell look)

## Summary

A fourth app theme, **Radio City** — a Halt-and-Catch-Fire / neon City-Pop skin: gradient night sky that comes alive (stars, drifting aurora, breathing bloom), a 看板 storefront-signboard sidebar, neon-tube billboard headers, subtle CRT, and the locked HACF viz vocabulary replacing the generic charts.

**Positioning vs existing themes:** orbital is aesthetic-first (3D WebGL escape, data secondary). Radio City is **function-first, cosmetic-second** — every page works, fast and readable; the neon is the wow layer on top. dark / liquid-glass / orbital are untouched.

**Tech:** DOM / CSS / SVG only (no WebGL, no new motion library). `lucide-react` (installed) for icons. Existing palette + viz forms from the gallery, ported to React.

## Decisions (locked)

- **Name:** Radio City. `Theme` type value `"radio"`.
- **Grade:** auto by local clock via existing `solarClock.ts`. No manual override in v1.
- **Scope:** one-shot all pages, via shared theme-aware components (pages are compositions of the existing chart components — theme the components + shell, every page inherits).
- **Out of scope v1:** weather integration, manual grade override, any hero/immersive city scene (dead end — see memory), Sleep Canyon (replaced by a styled real hypnogram).

## Architecture

New code under `frontend/src/radio/`. Existing chart components in `frontend/src/components/charts/` become theme-aware (render the Radio form when `theme === "radio"`, else current behavior).

### 1. Theme registration
- `atoms/theme.ts`: add `"radio"` to `Theme` union.
- `components/layout/Shell.tsx`: add a `theme === "radio"` branch rendering `<RadioShell>` (which renders `<Sidebar>`-equivalent + `<Outlet/>`). Mirrors the existing branch structure; other themes unchanged.
- `pages/Settings.tsx`: add Radio City to the theme picker.

### 2. Phase engine — `radio/phase.ts`
- Derive phase `sunrise | day | dusk | night` from `solarDayFraction(new Date())` (reuse `useSolarClock` so it ticks each minute and honors `?timeFixture=`).
- Export `radioPhaseAtom` (or a `useRadioPhase()` hook) returning the phase + its token bundle: `{ grade: { g1,g2,g3 (gradient stops), bloomA, bloomB, acc (accent), glow (0..1), cp (City-Pop bool) }, label }`.
- Phase bundles (from mocks, all dark-usable):
  - **night** — indigo→black, cyan accent, glow 1.0, cp false
  - **dusk** — indigo→warm magenta/amber horizon, rose accent, glow 0.7, cp false
  - **sunrise** — magenta/amber dawn, glow 0.5, cp true
  - **day** — deep aqua-teal (City Pop, but legible — NOT bright white), glow 0.25, cp true
- Honor `prefers-reduced-motion`: when set, freeze drift/aurora/rain/dust/flicker, keep the static gradient + grade.
- This is the single source of truth; shell and all viz read from it.

### 3. Shell — `radio/RadioShell.tsx` (+ `radio/radio.css`)
Layered, low z-index first:
- **Backdrop** (`z-0..2`, cheap CSS, behind content): phase gradient (slow `--bx` drift) + breathing bloom + twinkling starfield (fade out when `cp`) + two drifting aurora ribbons (`--acc` + magenta) + occasional shooting star + floating phosphor dust.
- **Signboard sidebar** (看板): nav items as lit neon plates — accurate kanji + `lucide-react` icon + label. Active item buzzes in `--acc`; inactive dim like an unlit shop sign; hover lights. Kanji: 今日 today · 回復 recovery · 睡眠 sleep · 負荷 strain · 日記 journal · logo 空 (air). Route list comes from the existing nav config.
- **Billboard header** (per route): neon-tube title (text-stroke + layered bloom, one glyph flickers) + kana mount. Title/kana per route.
- **CRT overlays** (`z-8/9`): subtle scanline + phosphor grain (SVG turbulence data-URI, opacity ~.06) + vignette. Kept deliberately subtle (locked rule — heavy CRT was rejected).
- Content well renders the existing page `<Outlet/>`.

### 4. Theme-aware viz — `radio/viz/`
Each gallery form ported to a small React/SVG component, driven by the same props/atoms the current chart receives. Each existing chart gets a `theme === "radio"` branch that renders the Radio form:

| Existing chart | Radio form | Notes |
|---|---|---|
| `RecoveryGauge` | **Dial** | segmented 80s LED arc + steel/neon bezel + italic LCD readout + word (PRIMED/HIGH) |
| `StrainGauge` | **Dial** | same primitive, strain color ramp |
| `TrendLine` | **Skyline** (windowed towers) | bars→lit-window towers; `Spire` variant for compact/sparkline use |
| `Sparkline` | **Spire** | neon silhouette + bloom |
| `HRChart` | **EQ** (equalizer) | zone-colored columns, peak caps |
| `HRZonesBar` | **ZoneStack** | floors = zones Z1–Z5, emissive at night |
| `YearHeatStrip` | **Facade** | week×day window grid, glow grades by phase |
| `SleepStagesChart` | **styled real hypnogram** | actual stage timeline (Wake/REM/Light/Deep steps across the night), neon-emissive bands + glow + mono axis. NOT the perspective "canyon". |

- All viz read `cp`/`glow`/`acc` from the phase engine and re-grade automatically (night = neon glow, day = chrome/City-Pop).
- Reuse the existing semantic color scales (recovery/strain/zone/stage) given a neon-emissive treatment — do not invent palettes.
- A shared `Dial` primitive serves both gauges. A shared backdrop/glow helper avoids per-cell 8-layer text-shadow (cheap box-shadow + one container bloom — locked perf rule).

### 5. Tokens
- A `.radio` CSS scope holds the palette vars (`--mag #ff2d78`, `--cy #16d8e8`, `--ind #8a4dff`, `--amb #ffb347`, base `#04030a`, text/muted) + the phase-driven vars (`--g1/2/3`, `--acc`, `--bloomA/B`, `--glow`) set from the phase engine.
- Content-only pages (Coach, HealthAge, Insights, Journal, Settings, Onboarding — no charts) inherit type/color/bg from the scope automatically; minimal per-page work.

## Component boundaries

- `radio/phase.ts` — phase + token bundle. Depends on `solarClock`. Pure-ish, testable (assert phase mapping for known day fractions).
- `radio/RadioShell.tsx` — layout + backdrop + sidebar + billboard + CRT. Depends on phase, route/nav config, `lucide-react`.
- `radio/viz/*` — one component per form. Depend on phase tokens + data props. Each independently testable/renderable.
- Chart components — add a thin Radio branch; existing behavior preserved for other themes.

## Non-functional

- **Perf / motion:** cap animated nodes (star/dust counts), prefer `transform`/`opacity` animations, one container bloom not per-cell stacks; `prefers-reduced-motion` freezes ambient motion. Verify no jank on a mid page.
- **A11y / contrast:** contrast pass on muted greys against the gradient; ensure data text + labels meet legibility at the night grade and small viz sizes.
- **Legibility:** viz must read at small/inline sizes (the gallery proved this for night; verify day/dusk).

## Open / deferred
- Weather-driven ambiance (needs a weather source) — future.
- Manual grade override / "freeze grade" control — future.
- Per-route billboard copy + kana — finalize during implementation against the real nav config.
