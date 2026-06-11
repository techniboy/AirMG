# NOOP-Parity Dashboard Rebuild — Design Spec

## Goal

Rebuild AirMG frontend (and supporting backend) to match NOOP's SwiftUI dashboard density, analytics, and visual language. Every page should feel like a direct port of NOOP's Control Center, Sleep, Trends, Insights, and Workouts screens — adapted for web and the Google Health API data available.

## Out of Scope

- AI Coach (BYOK OpenAI/Anthropic chat) — keep existing rule-based Coach page as-is
- Weight and skin temperature tiles (no data source from Google Health API)
- BLE strap connection / live HR (desktop-only NOOP feature)
- Data Sources section on Today (single source — Google Health)
- Settings and Journal page changes

## Architecture

Three-layer build: backend engines/endpoints first, then shared chart/tile components, then page rebuilds. This avoids mock data and ensures components exist before pages compose them.

**Tech stack:** Python 3.13 + FastAPI (backend), React 19 + Vite + TypeScript + Tailwind v4 + jotai + jotai-tanstack-query (frontend), SQLite (store).

---

## Layer 1: Backend — New Engines & Endpoints

### 1.1 ReadinessEngine (`analytics/readiness.py`)

Computes a training-readiness assessment from the last 28 days of `daily_metrics`. Mirrors NOOP's `ReadinessEngine.evaluate()`.

**Data structures:**

```python
@dataclass(frozen=True, slots=True)
class Signal:
    key: str      # "hrv_trend" | "rhr_deviation" | "load_ratio" | "sleep_debt"
    label: str    # "HRV Trend"
    detail: str   # "8% above baseline"
    flag: str     # "good" | "neutral" | "watch" | "bad"

@dataclass(frozen=True, slots=True)
class ReadinessResult:
    level: str          # "primed" | "balanced" | "strained" | "rundown" | "insufficient"
    headline: str       # "Ready to push" / "Take it easy"
    summary: str        # 1-2 sentence plain English
    acwr: float | None  # acute:chronic workload ratio
    signals: list[Signal]
```

**Logic — four signals:**

1. **HRV Trend** — z-score of today's HRV vs HRV baseline (from `baselines` table). Flag: good if z > 0, neutral if -0.5 < z <= 0, watch if -1 < z <= -0.5, bad if z <= -1.
2. **RHR Deviation** — today's resting_hr minus RHR baseline mean. Flag: good if <= 0, neutral if 1-2, watch if 3-4, bad if >= 5.
3. **Load Ratio (ACWR)** — `sum(strain, last 7 days) / (sum(strain, last 28 days) / 4)`. Sweet spot 0.8–1.3. Flag: good if 0.8–1.3, watch if 1.3–1.5 or 0.5–0.8, bad if >1.5 or <0.5.
4. **Sleep Debt** — `avg(sleep_minutes, last 3 days)` vs `profile.sleep_need_hours * 60`. Flag: good if >= 90% of need, neutral if 80-90%, watch if 70-80%, bad if <70%.

**Level determination:**
- Any signal "bad" → `rundown`
- Any signal "watch" → `strained`
- All signals "good" → `primed`
- Otherwise → `balanced`
- Fewer than 7 days of data → `insufficient`

**Headline and summary** — lookup table keyed by level, with dynamic interpolation of signal values.

**Endpoint:** `GET /api/readiness`

Returns `ReadinessResult` as JSON. Reads `daily_metrics` (last 28 days), `baselines` (hrv, resting_hr), and `profile` (sleep_need_hours).

### 1.2 BehaviorInsights (`analytics/behaviors.py`)

For each journal question, splits days into "answered yes" vs "answered no" (or not logged) groups, compares an outcome metric between the two groups using Cohen's d effect size.

**Data structures:**

```python
@dataclass(frozen=True, slots=True)
class BehaviorEffect:
    question_key: str
    question: str
    category: str
    with_mean: float       # mean outcome on days with behaviour
    without_mean: float    # mean outcome on days without
    effect_size: float     # Cohen's d
    n_with: int
    n_without: int
    significant: bool      # |d| >= 0.2 and min 5 per group
    direction: str         # "positive" | "negative" | "neutral"
    sentence: str          # "Meditation is associated with 8% higher Recovery"
```

**Logic:**

1. Load all journal entries (last 90 days).
2. For each unique question_key, partition days into `with_days` (answer=true) and `without_days` (answer=false or no entry).
3. For each partition, look up the outcome metric from `daily_metrics` for those days.
4. Compute means, pooled SD, Cohen's d = `(mean_with - mean_without) / pooled_sd`.
5. Direction: for outcome where higher_is_better (recovery, hrv, sleep_perf), positive d = "positive". For rhr, invert.
6. Generate sentence: "{Question} is associated with {abs_pct_diff}% {higher/lower} {outcome_name}".
7. Rank by `|effect_size|` descending.

**Endpoint:** `GET /api/insights/behaviours?outcome=recovery`

Query param `outcome` is one of: `recovery`, `hrv`, `sleep_performance`, `resting_hr`. Returns `{"effects": [BehaviorEffect, ...]}`.

### 1.3 Sparklines Endpoint (`routes/dashboard.py`)

`GET /api/sparklines?days=14`

Returns trailing-window values for every metric in `daily_metrics`:

```json
{
  "recovery": [72, 65, 81, null, 68, ...],
  "strain": [8.2, 12.1, ...],
  "hrv_rmssd": [58, 62, ...],
  "resting_hr": [52, 51, ...],
  "sleep_minutes": [420, 390, ...],
  "sleep_performance": [85, 78, ...],
  "spo2": [96, 97, ...],
  "resp_rate": [14.5, 14.8, ...],
  "steps": [8200, 10500, ...],
  "calories": [2100, 2400, ...]
}
```

Queries `daily_metrics` for the last N days (default 14). Each array is ordered oldest→newest. Null values preserved (days with no data).

### 1.4 HR Trend Endpoint (`routes/dashboard.py`)

`GET /api/hr-trend?day=2026-06-11`

Returns 5-minute bucketed heart rate means for a single day:

```json
{
  "points": [{"ts": 1718064000, "bpm": 62.3}, {"ts": 1718064300, "bpm": 64.1}, ...],
  "min": 48,
  "avg": 65,
  "max": 142
}
```

Reads from `samples` table where `type='hr'` and timestamp falls within the day. Groups into 5-minute (300s) buckets, computes mean BPM per bucket.

### 1.5 Workouts Summary Endpoint (`routes/workouts.py`)

`GET /api/workouts/summary?days=30`

Aggregated workout stats over the trailing window:

```json
{
  "count": 12,
  "total_minutes": 840,
  "total_calories": 6200,
  "sport_breakdown": [
    {"type": "Running", "count": 5, "minutes": 300, "avg_strain": 14.2, "avg_hr": 148},
    {"type": "Cycling", "count": 4, "minutes": 360, "avg_strain": 11.8, "avg_hr": 135}
  ],
  "hr_zones": {"1": 1200, "2": 3400, "3": 2800, "4": 900, "5": 100}
}
```

Queries `workouts` table. For HR zones, loads HR samples for each workout's time window and uses existing `zones.time_in_zones()`. `sport_breakdown` grouped by `workouts.type`. Sorted by count descending.

### 1.6 Pipeline Enrichment (`analytics/pipeline.py`)

Extend `compute_daily_metrics` to also compute and store:

- **`resp_rate`** — average from `samples` where `type='resp_rate'` for the day. Currently null.
- **`calories`** — sum of `workouts.calories` for workouts starting that day. Currently null.
- **`deep_minutes`, `rem_minutes`, `light_minutes`, `wake_minutes`** — parse from `sleep_sessions.stages_json`. Currently computed in sleep route but not stored in daily_metrics by the pipeline.

### 1.7 New Jotai Atoms (`atoms/api.ts`)

Add atoms for new endpoints:

```typescript
export const sparklinesAtom = atomWithQuery(() => ({
  queryKey: ["sparklines"],
  queryFn: () => api<SparklineData>("/api/sparklines?days=14"),
}));

export const readinessAtom = atomWithQuery(() => ({
  queryKey: ["readiness"],
  queryFn: () => api<ReadinessResult>("/api/readiness"),
}));

export const hrTrendAtom = atomWithQuery(() => ({
  queryKey: ["hr-trend"],
  queryFn: () => api<HRTrendData>("/api/hr-trend"),
}));

export const behaviourOutcomeAtom = atom<"recovery" | "hrv" | "sleep_performance" | "resting_hr">("recovery");

export const behaviourEffectsAtom = atomWithQuery((get) => ({
  queryKey: ["behaviour-effects", get(behaviourOutcomeAtom)],
  queryFn: () => api<{effects: BehaviorEffect[]}>(`/api/insights/behaviours?outcome=${get(behaviourOutcomeAtom)}`),
}));

export const workoutsRangeAtom = atom<"7d" | "30d" | "90d" | "1y" | "all">("30d");

export const workoutsSummaryAtom = atomWithQuery((get) => {
  const days = {"7d": 7, "30d": 30, "90d": 90, "1y": 365, "all": 9999}[get(workoutsRangeAtom)];
  return {
    queryKey: ["workouts-summary", days],
    queryFn: () => api<WorkoutsSummary>(`/api/workouts/summary?days=${days}`),
  };
});
```

---

## Layer 2: Frontend — New Components

### 2.1 Sparkline (`components/charts/Sparkline.tsx`)

Tiny inline SVG polyline. No axes, no labels.

**Props:**
- `values: (number | null)[]` — data points oldest→newest
- `color: string` — stroke color
- `width?: number` — default 80
- `height?: number` — default 24

**Behavior:** Maps values to y-coordinates within the viewBox. Null values create gaps in the polyline (break into segments). Fills area below line with 15% opacity of the stroke color. Rounded stroke-linecap.

### 2.2 StatTile (`components/shared/StatTile.tsx`)

Uniform metric tile with sparkline. Replaces `MetricCard` on Today page.

**Props:**
```typescript
interface StatTileProps {
  label: string;
  value: string;
  caption?: string;
  color?: string;
  sparkline?: (number | null)[];
  sparkColor?: string;
  delta?: string;
  deltaColor?: string;
}
```

**Layout:** `bg-surface-raised border-hairline rounded-xl p-3 min-h-[90px]`. Label (11px, text-tertiary) top-left. Value (24px, bold, colored) below label. Caption (11px, text-tertiary) below value. Sparkline component right-aligned vertically centered. Delta (if present) bottom-right in deltaColor.

### 2.3 ReadinessCard (`components/shared/ReadinessCard.tsx`)

Full-width readiness assessment card.

**Props:** `result: ReadinessResult` (from API).

**Layout:**
- Overline: "Should you push today?" (uppercase, text-tertiary)
- Row: colored level dot (10px circle) + headline + ACWR badge (right-aligned, text-tertiary)
- Summary paragraph (text-secondary)
- Divider
- Signal rows: dot (7px, flag-colored) + label (fixed width) + detail (text-tertiary)

**Color mapping:** primed → accent (#18C98B), balanced → status-positive, strained → status-warning, rundown → metric-rose, insufficient → text-tertiary.

### 2.4 SynthesisCard (`components/shared/SynthesisCard.tsx`)

Plain-English recovery read-out for the Today hero.

**Props:**
- `status: string` — "Steady", "Depleted", "Peak", etc.
- `detail: string` — "Recovery is steady and sleep was consistent."
- `statusColor: string`

**Layout:** `bg-surface-raised border-hairline rounded-xl p-6`. Category label ("Recovery", uppercase text-tertiary). Status (20px, bold, statusColor). Detail paragraph (13px, text-secondary, line-height 1.5).

### 2.5 YearHeatStrip (`components/charts/YearHeatStrip.tsx`)

SVG calendar heatmap of recovery scores.

**Props:**
- `data: {day: string, value: number | null}[]` — up to 365 days
- `colorScale?: (value: number) => string` — defaults to recovery color scale

**Layout:** 52 columns (weeks) × 7 rows (Mon–Sun) of rounded rectangles (size ~12px with 2px gap). Month labels along the top edge. Tooltip on hover showing "Mon, Jun 9 — 72%". Null/missing days rendered as `bg-surface-inset` (empty). Color scale: <33 red, 33-66 yellow-amber, 67+ green.

### 2.6 BehaviourCard (`components/shared/BehaviourCard.tsx`)

Behaviour effect card for Insights page.

**Props:** `effect: BehaviorEffect` (from API).

**Layout:**
- Category icon (reuse Journal's `categoryIcon`) + question text
- Two horizontal bars: "With" bar (colored by direction: green if positive, red if negative) and "Without" bar (neutral gray). Widths proportional to means. Mean values labeled at bar ends.
- Effect size badge: "Small" (|d| 0.2–0.5), "Medium" (0.5–0.8), "Large" (>0.8)
- Significance pill: "Significant" or "n.s."
- Plain-English sentence (text-secondary)
- Group counts: "n = {n_with} with, {n_without} without"

### 2.7 HRZonesBar (`components/charts/HRZonesBar.tsx`)

Stacked horizontal bar showing time-in-zones.

**Props:**
- `zones: Record<number, number>` — zone number → seconds (or sample count)
- `maxHr?: number` — for label rendering

**Layout:** Single horizontal bar, divided into 5 colored segments. Zone 1 (lightest) → Zone 5 (darkest red). Segment widths proportional to time. Zone number labels centered in each segment if wide enough. Hover tooltip: "Zone 3: 47 min (33%)".

---

## Layer 3: Page Rebuilds

### 3.1 Today — Full Dashboard Rebuild

**Replaces** the current 3-score + 4-metric + WeekStrip layout.

**Data sources:** `todayMetricsAtom`, `sparklinesAtom`, `readinessAtom`, `hrTrendAtom`, `workoutsAtom`.

**Sections (top to bottom):**

1. **Header** — "Control Center" title + greeting word (Good morning/afternoon/evening) + date subtitle.

2. **Hero** — `flex` row, two equal-width cards:
   - Left: `RecoveryGauge` (existing component, size=168) inside a card. Shows recovery score, band label. When recovery is null, shows "Calibrating — N of 4 nights" or "No Data".
   - Right: `SynthesisCard` with status word (Depleted/Low/Steady/Primed/Peak based on score bands) and plain-English summary (recovery state + sleep quality).

3. **HR Trend** — `Card` with:
   - Header: "Heart Rate" overline, "5-min avg · since midnight" subtitle, current BPM trailing.
   - `TrendLine` (existing component) with HR data points, color metric-rose.
   - Footer: Min / Avg / Max stats.
   - Hidden when fewer than 2 data points.

4. **Readiness** — `ReadinessCard` component. Hidden when level is "insufficient".

5. **Key Metrics** — Section header "Key Metrics · 14-day trend". Adaptive grid (`grid-cols-[repeat(auto-fill,minmax(168px,1fr))]`) of `StatTile` components:
   - Recovery (color: accent, caption: band label)
   - Day Strain (color: strain color, caption: "of 21")
   - Sleep (color: metric-purple, caption: efficiency %)
   - HRV (color: metric-purple, caption: "ms")
   - Resting HR (color: metric-rose, caption: "bpm")
   - Blood Oxygen (color: metric-cyan, caption: "SpO₂")
   - Respiratory (color: accent, caption: "rpm")
   - Steps (color: metric-cyan, caption: "today")
   - Calories (color: metric-amber, caption: "active")

   Each tile's sparkline data comes from `sparklinesAtom`.

6. **Last Workouts** — Section header "Last Workouts · Activity". Same adaptive grid of `StatTile` components for up to 6 most recent workouts:
   - Label: sport type
   - Value: duration (Xh Ym)
   - Caption: date + avg HR
   - Delta: calories (metric-amber)
   - No sparkline.

**Removed:** `WeekStrip` (sparklines on every tile replace it), `ScoreBadge` (replaced by RecoveryGauge in hero).

### 3.2 Sleep — Enriched

**Keeps** existing structure. **Adds** three sections.

**Data sources:** `sleepDetailAtom` (existing), `sparklinesAtom` (new), `trendsAtom` (existing, for 30-day trend).

**Changes:**

1. **StatTile grid replaces MetricCards** — swap both MetricCard grids for a single adaptive `StatTile` grid:
   - Sleep Performance (sparkline from sparklines.sleep_performance)
   - Efficiency (sparkline computed: efficiency values from trend data)
   - Restorative (value: `round((deep + rem) / total * 100)%`, no sparkline)
   - Sleep Debt (value: `total_min - need_hours * 60` as "+/-Xm", need from profile settings)
   - Deep (sparkline from daily deep_minutes)
   - REM (sparkline from daily rem_minutes)
   - HRV (sparkline from sparklines.hrv_rmssd)
   - Resting HR (sparkline from sparklines.resting_hr)
   - Resp Rate (sparkline from sparklines.resp_rate)

   Each tile includes "vs typical" caption: compares to baseline mean from `baselines` table. Format: "↑12% vs typical" or "↓5% vs typical" or "typical". Requires a new endpoint or extending sleep detail to include baseline comparisons.

   **New endpoint for baselines:** `GET /api/baselines` → returns `{metric: {mean, spread, status}}` for all baselines. Frontend computes "vs typical" from sparkline's latest value vs baseline mean.

2. **"Stages vs Typical" card** — new section below stage breakdown:
   - Three horizontal bars: Deep, REM, Light.
   - Each bar: full width = max(last_night, typical) + 20% padding. Last-night value as colored bar. Vertical marker line at personal typical (mean of last 30 days' deep/rem/light minutes from trends data).
   - Labels: "{Xh Ym} last night" and "typical {Xh Ym}".

3. **30-day sleep trend** — `Card` at bottom:
   - Header: "Sleep Duration · 30 days"
   - `TrendLine` showing sleep_minutes over last 30 days.
   - Color: metric-purple. Domain auto-scaled.
   - Data fetched via `trendsAtom` with sleep_minutes metric (reuse existing atom, temporarily set trendsRangeAtom to 30d and trendsMetricAtom to sleep_minutes — or add a dedicated `sleepTrendAtom`).

   **Decision:** Add `sleepTrendAtom` — a dedicated atom that always fetches 30 days of sleep_minutes. Avoids coupling to the Trends page state.

   ```typescript
   export const sleepTrendAtom = atomWithQuery(() => {
     const d = new Date();
     d.setDate(d.getDate() - 29);
     const start = d.toISOString().slice(0, 10);
     const end = new Date().toISOString().slice(0, 10);
     return {
       queryKey: ["sleep-trend"],
       queryFn: () => api<{days: DailyMetrics[]}>(`/api/trends?start=${start}&end=${end}&metrics=sleep_minutes`),
     };
   });
   ```

### 3.3 Trends — Expanded

**Data sources:** `trendsAtom` (existing, extended), `weekMetricsAtom` extended for longer ranges.

**Changes:**

1. **Extended ranges** — add `"6m"`, `"1y"`, `"all"` to `trendsRangeAtom` type. Update `trendsAtom` to compute start date for 180d, 365d, and all (use a very early date like "2000-01-01"). Add range buttons for 6M, 1Y, ALL.

2. **Multi-metric simultaneous view** — below the hero chart (which stays as single-metric selector), add a "Supporting Metrics" section with three smaller `TrendLine` charts always visible:
   - HRV (color: metric-purple, domain auto)
   - Resting HR (color: metric-rose, domain auto)
   - Day Strain (color: strain-orange, domain [0, 21])

   These always show the same time range as the hero. Data fetched by extending the trends query to include all four metrics: `metrics=recovery,hrv_rmssd,resting_hr,strain`.

   **Implementation:** Change `trendsAtom` to always fetch all metrics (not just the selected one). The hero chart renders the selected metric; the three supporting charts render the other three. No extra API calls.

3. **YearHeatStrip** — at the bottom of the page. Dedicated atom:

   ```typescript
   export const yearRecoveryAtom = atomWithQuery(() => {
     const d = new Date();
     d.setDate(d.getDate() - 364);
     const start = d.toISOString().slice(0, 10);
     const end = new Date().toISOString().slice(0, 10);
     return {
       queryKey: ["year-recovery"],
       queryFn: () => api<{days: DailyMetrics[]}>(`/api/trends?start=${start}&end=${end}&metrics=recovery`),
     };
   });
   ```

   Renders `YearHeatStrip` component with recovery values.

4. **Auto-expand** — if the selected range produces zero data points, try each wider range in order until data found. Frontend logic in the component: check `trendPoints.length === 0`, then `setSelectedRange` to next wider option. Cap at "all" to prevent infinite loop.

### 3.4 Insights — Behaviour Effects

**Data sources:** `insightsAtom` (existing), `behaviourEffectsAtom` (new), `behaviourOutcomeAtom` (new).

**Layout (top to bottom):**

1. **Header** — "Insights" title + subtitle.

2. **Behaviour Effects section** (NEW):
   - Section header: "Behaviour Effects"
   - Outcome selector: segmented pill bar — Recovery / HRV / Sleep / RHR. Drives `behaviourOutcomeAtom`.
   - List of `BehaviourCard` components, ranked by |effect_size| descending.
   - Empty state: "Log more journal entries to see behaviour effects. At least 5 days with and without each behaviour needed."

3. **Metric Relationships section** (existing correlations):
   - Section header: "Metric Relationships"
   - Existing correlation cards — no changes.

### 3.5 Workouts — Enriched

**Data sources:** `workoutsAtom` (existing, add range filter), `workoutsSummaryAtom` (new), `workoutsRangeAtom` (new).

**Layout (top to bottom):**

1. **Header** — "Workouts" title + session count.

2. **Range filter** — pill bar: 7D / 30D / 90D / 1Y / All. Drives `workoutsRangeAtom`.

3. **Summary StatTiles** — adaptive grid of 4 tiles (no sparklines):
   - Sessions: count
   - Total Time: formatted hours/minutes
   - Calories: total, formatted with thousands separator
   - Most Active: sport type with highest count

4. **Sport Breakdown** — one card per sport type:
   - Sport name + count
   - Total minutes + avg strain
   - Avg HR

5. **HR Zones** — `HRZonesBar` component with aggregate time-in-zones.

6. **All Sessions** — existing workout cards, now filtered by `workoutsRangeAtom`. Modify `workoutsAtom` to accept a range parameter, or filter client-side.

   **Decision:** Filter client-side. Change existing workouts endpoint default limit from 20 to 500 (covers any reasonable range). Filter in the component by `start_ts` vs range cutoff date. Simpler than adding range params to the endpoint.

---

## New Backend Endpoint Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/readiness` | GET | Training readiness assessment |
| `/api/sparklines?days=14` | GET | Trailing metric values for sparklines |
| `/api/hr-trend?day=YYYY-MM-DD` | GET | 5-min bucketed HR for one day |
| `/api/insights/behaviours?outcome=recovery` | GET | Journal behaviour effect analysis |
| `/api/workouts/summary?days=30` | GET | Aggregated workout stats |
| `/api/baselines` | GET | All baseline means/spreads |

## New Frontend Component Summary

| Component | Location | Purpose |
|-----------|----------|---------|
| `Sparkline` | `components/charts/Sparkline.tsx` | Inline SVG sparkline |
| `StatTile` | `components/shared/StatTile.tsx` | Metric tile with sparkline |
| `ReadinessCard` | `components/shared/ReadinessCard.tsx` | Readiness assessment card |
| `SynthesisCard` | `components/shared/SynthesisCard.tsx` | Recovery synthesis text |
| `YearHeatStrip` | `components/charts/YearHeatStrip.tsx` | Calendar heatmap |
| `BehaviourCard` | `components/shared/BehaviourCard.tsx` | Behaviour effect card |
| `HRZonesBar` | `components/charts/HRZonesBar.tsx` | HR zones stacked bar |

## New Jotai Atoms Summary

| Atom | Type | Purpose |
|------|------|---------|
| `sparklinesAtom` | query | 14-day sparkline data |
| `readinessAtom` | query | Readiness assessment |
| `hrTrendAtom` | query | Today's HR trend |
| `behaviourOutcomeAtom` | primitive | Selected outcome for behaviour effects |
| `behaviourEffectsAtom` | query (derived) | Behaviour effects for selected outcome |
| `workoutsRangeAtom` | primitive | Selected workout range |
| `workoutsSummaryAtom` | query (derived) | Workout summary for selected range |
| `sleepTrendAtom` | query | 30-day sleep duration trend |
| `yearRecoveryAtom` | query | 365-day recovery for heatmap |
| `baselinesAtom` | query | All baseline values |

## TypeScript Types (`lib/types.ts` additions)

```typescript
interface SparklineData {
  recovery: (number | null)[];
  strain: (number | null)[];
  hrv_rmssd: (number | null)[];
  resting_hr: (number | null)[];
  sleep_minutes: (number | null)[];
  sleep_performance: (number | null)[];
  spo2: (number | null)[];
  resp_rate: (number | null)[];
  steps: (number | null)[];
  calories: (number | null)[];
}

interface ReadinessSignal {
  key: string;
  label: string;
  detail: string;
  flag: "good" | "neutral" | "watch" | "bad";
}

interface ReadinessResult {
  level: "primed" | "balanced" | "strained" | "rundown" | "insufficient";
  headline: string;
  summary: string;
  acwr: number | null;
  signals: ReadinessSignal[];
}

interface HRTrendPoint {
  ts: number;
  bpm: number;
}

interface HRTrendData {
  points: HRTrendPoint[];
  min: number;
  avg: number;
  max: number;
}

interface BehaviorEffect {
  question_key: string;
  question: string;
  category: string;
  with_mean: number;
  without_mean: number;
  effect_size: number;
  n_with: number;
  n_without: number;
  significant: boolean;
  direction: "positive" | "negative" | "neutral";
  sentence: string;
}

interface SportBreakdown {
  type: string;
  count: number;
  minutes: number;
  avg_strain: number;
  avg_hr: number;
}

interface WorkoutsSummary {
  count: number;
  total_minutes: number;
  total_calories: number;
  sport_breakdown: SportBreakdown[];
  hr_zones: Record<number, number>;
}

interface BaselineInfo {
  mean: number;
  spread: number;
  status: string;
}

interface BaselinesResponse {
  [metric: string]: BaselineInfo;
}
```
