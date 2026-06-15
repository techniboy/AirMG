# NOOP-Parity Dashboard Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild AirMG to match NOOP's dashboard density — new backend engines (readiness, behaviour insights), sparkline/stat-tile components, and full page rebuilds for Today, Sleep, Trends, Insights, Workouts.

**Architecture:** Three layers built in order: (1) backend engines + endpoints, (2) frontend chart/tile components, (3) page rebuilds. Each layer builds on the previous so no mock data is needed.

**Tech Stack:** Python 3.13 / FastAPI / SQLite (backend), React 19 / Vite / TypeScript / Tailwind v4 / jotai / jotai-tanstack-query / recharts (frontend)

**Spec:** `docs/superpowers/specs/2026-06-11-noop-parity-design.md`

---

## File Structure

### Backend — New Files
- `backend/src/airmg/analytics/readiness.py` — ReadinessEngine (training-readiness assessment)
- `backend/src/airmg/analytics/behaviors.py` — BehaviorInsights (journal behaviour effects)
- `backend/src/airmg/routes/readiness.py` — `/api/readiness` endpoint
- `backend/src/airmg/routes/baselines_route.py` — `/api/baselines` endpoint
- `backend/tests/test_readiness.py` — ReadinessEngine tests
- `backend/tests/test_behaviors.py` — BehaviorInsights tests

### Backend — Modified Files
- `backend/src/airmg/routes/dashboard.py` — add `/api/sparklines` and `/api/hr-trend`
- `backend/src/airmg/routes/insights.py` — add `/api/insights/behaviours`
- `backend/src/airmg/routes/workouts.py` — add `/api/workouts/summary`, increase default limit
- `backend/src/airmg/analytics/pipeline.py` — enrich daily_metrics with resp_rate, calories, sleep stages
- `backend/src/airmg/store/reads.py` — add `get_journal_entries_range` helper
- `backend/src/airmg/main.py` — register new routers

### Frontend — New Files
- `frontend/src/components/charts/Sparkline.tsx` — inline SVG sparkline
- `frontend/src/components/charts/YearHeatStrip.tsx` — calendar heatmap
- `frontend/src/components/charts/HRZonesBar.tsx` — HR zones stacked bar
- `frontend/src/components/shared/StatTile.tsx` — metric tile with sparkline
- `frontend/src/components/shared/ReadinessCard.tsx` — readiness assessment card
- `frontend/src/components/shared/SynthesisCard.tsx` — recovery synthesis text
- `frontend/src/components/shared/BehaviourCard.tsx` — behaviour effect card

### Frontend — Modified Files
- `frontend/src/lib/types.ts` — add 8 new interfaces
- `frontend/src/atoms/api.ts` — add 10 new atoms
- `frontend/src/pages/Today.tsx` — full rebuild
- `frontend/src/pages/Sleep.tsx` — enrichment (StatTiles, stages vs typical, trend)
- `frontend/src/pages/Trends.tsx` — expansion (ranges, multi-metric, heatmap)
- `frontend/src/pages/Insights.tsx` — add behaviour effects section
- `frontend/src/pages/Workouts.tsx` — enrichment (range, summary, breakdown, zones)

---

### Task 1: ReadinessEngine

**Files:**
- Create: `backend/src/airmg/analytics/readiness.py`
- Create: `backend/tests/test_readiness_engine.py`

- [ ] **Step 1: Write the test file**

```python
# backend/tests/test_readiness_engine.py
import tempfile
from pathlib import Path

from airmg.analytics.readiness import ReadinessEngine, ReadinessResult, Signal
from airmg.store.db import get_connection, init_db
from airmg.store.writes import upsert_daily_metrics, upsert_baseline, set_profile


def _setup_db():
    tmp = tempfile.mkdtemp()
    db_path = Path(tmp) / "test.db"
    init_db(db_path)
    return get_connection(db_path)


def _seed_days(conn, n_days=28, recovery=70.0, strain=10.0, hrv=55.0, rhr=55.0, sleep_min=480):
    base_ts = 1718000000
    from datetime import date, timedelta
    today = date.today()
    for i in range(n_days):
        day = (today - timedelta(days=n_days - 1 - i)).isoformat()
        upsert_daily_metrics(conn, {
            "day": day,
            "recovery": recovery + (i % 5),
            "strain": strain + (i % 3),
            "hrv_rmssd": hrv + (i % 4),
            "resting_hr": rhr,
            "sleep_minutes": sleep_min,
        })


def test_insufficient_with_few_days():
    conn = _setup_db()
    _seed_days(conn, n_days=3)
    upsert_baseline(conn, "hrv", mean=55.0, spread=8.0, n_valid=14, status="trusted")
    upsert_baseline(conn, "resting_hr", mean=55.0, spread=3.0, n_valid=14, status="trusted")
    result = ReadinessEngine.evaluate(conn)
    assert result.level == "insufficient"
    conn.close()


def test_primed_when_all_good():
    conn = _setup_db()
    _seed_days(conn, n_days=28, hrv=65.0, rhr=52.0, strain=10.0, sleep_min=510)
    upsert_baseline(conn, "hrv", mean=55.0, spread=8.0, n_valid=14, status="trusted")
    upsert_baseline(conn, "resting_hr", mean=55.0, spread=3.0, n_valid=14, status="trusted")
    set_profile(conn, "sleep_need_hours", "8")
    result = ReadinessEngine.evaluate(conn)
    assert result.level == "primed"
    assert result.acwr is not None
    assert len(result.signals) == 4
    conn.close()


def test_rundown_when_bad_signal():
    conn = _setup_db()
    _seed_days(conn, n_days=28, hrv=30.0, rhr=65.0, strain=18.0, sleep_min=300)
    upsert_baseline(conn, "hrv", mean=55.0, spread=8.0, n_valid=14, status="trusted")
    upsert_baseline(conn, "resting_hr", mean=55.0, spread=3.0, n_valid=14, status="trusted")
    set_profile(conn, "sleep_need_hours", "8")
    result = ReadinessEngine.evaluate(conn)
    assert result.level == "rundown"
    conn.close()


def test_result_has_headline_and_summary():
    conn = _setup_db()
    _seed_days(conn, n_days=28)
    upsert_baseline(conn, "hrv", mean=55.0, spread=8.0, n_valid=14, status="trusted")
    upsert_baseline(conn, "resting_hr", mean=55.0, spread=3.0, n_valid=14, status="trusted")
    set_profile(conn, "sleep_need_hours", "8")
    result = ReadinessEngine.evaluate(conn)
    assert isinstance(result.headline, str) and len(result.headline) > 0
    assert isinstance(result.summary, str) and len(result.summary) > 0
    conn.close()


def test_acwr_calculation():
    conn = _setup_db()
    from datetime import date, timedelta
    today = date.today()
    # 7 days high strain, 21 days low strain
    for i in range(28):
        day = (today - timedelta(days=27 - i)).isoformat()
        strain = 18.0 if i >= 21 else 5.0
        upsert_daily_metrics(conn, {
            "day": day, "recovery": 70.0, "strain": strain,
            "hrv_rmssd": 55.0, "resting_hr": 55.0, "sleep_minutes": 480,
        })
    upsert_baseline(conn, "hrv", mean=55.0, spread=8.0, n_valid=14, status="trusted")
    upsert_baseline(conn, "resting_hr", mean=55.0, spread=3.0, n_valid=14, status="trusted")
    set_profile(conn, "sleep_need_hours", "8")
    result = ReadinessEngine.evaluate(conn)
    # ACWR = (7*18) / ((21*5 + 7*18)/4) = 126 / ((105+126)/4) = 126/57.75 ≈ 2.18
    assert result.acwr is not None
    assert result.acwr > 1.5  # should be "bad"
    # Find load_ratio signal
    load_sig = [s for s in result.signals if s.key == "load_ratio"]
    assert len(load_sig) == 1
    assert load_sig[0].flag == "bad"
    conn.close()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/suryaprasad/projects/air_mg/backend && python -m pytest tests/test_readiness_engine.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'airmg.analytics.readiness'`

- [ ] **Step 3: Implement ReadinessEngine**

```python
# backend/src/airmg/analytics/readiness.py
from __future__ import annotations

import sqlite3
from dataclasses import dataclass, asdict
from datetime import date, timedelta

from airmg.analytics.baselines import BaselineState, BaselineStatus
from airmg.store.reads import get_daily_metrics_range, get_baseline, get_profile


@dataclass(frozen=True, slots=True)
class Signal:
    key: str
    label: str
    detail: str
    flag: str  # "good" | "neutral" | "watch" | "bad"


@dataclass(frozen=True, slots=True)
class ReadinessResult:
    level: str
    headline: str
    summary: str
    acwr: float | None
    signals: list[Signal]

    def to_dict(self) -> dict:
        return {
            "level": self.level,
            "headline": self.headline,
            "summary": self.summary,
            "acwr": round(self.acwr, 2) if self.acwr is not None else None,
            "signals": [asdict(s) for s in self.signals],
        }


HEADLINES = {
    "primed": "Ready to push",
    "balanced": "Moderate effort today",
    "strained": "Take it easy",
    "rundown": "Rest and recover",
    "insufficient": "Building your baseline",
}

SUMMARIES = {
    "primed": "All signals are positive. Your body is ready for high intensity.",
    "balanced": "Most signals are steady. A regular session is appropriate.",
    "strained": "Some signals need attention. Keep intensity moderate and listen to your body.",
    "rundown": "Multiple warning signs. Focus on rest, sleep, and active recovery today.",
    "insufficient": "Not enough data yet to assess readiness. Keep syncing.",
}


class ReadinessEngine:
    @staticmethod
    def _hrv_signal(today_hrv: float | None, baseline_row: dict | None) -> Signal | None:
        if today_hrv is None or baseline_row is None:
            return None
        if baseline_row["status"] not in ("provisional", "trusted"):
            return None
        mean = baseline_row["mean"]
        spread = max(baseline_row["spread"] * 1.253, 1e-9)
        z = (today_hrv - mean) / spread
        pct = round(abs(today_hrv - mean) / mean * 100) if mean > 0 else 0
        direction = "above" if z > 0 else "below"

        if z > 0:
            flag = "good"
        elif z > -0.5:
            flag = "neutral"
        elif z > -1.0:
            flag = "watch"
        else:
            flag = "bad"

        return Signal(
            key="hrv_trend",
            label="HRV Trend",
            detail=f"{pct}% {direction} baseline",
            flag=flag,
        )

    @staticmethod
    def _rhr_signal(today_rhr: float | None, baseline_row: dict | None) -> Signal | None:
        if today_rhr is None or baseline_row is None:
            return None
        if baseline_row["status"] not in ("provisional", "trusted"):
            return None
        mean = baseline_row["mean"]
        dev = today_rhr - mean

        if dev <= 0:
            flag = "good"
            detail = f"{abs(round(dev))} bpm below baseline"
        elif dev <= 2:
            flag = "neutral"
            detail = f"{round(dev)} bpm above baseline"
        elif dev <= 4:
            flag = "watch"
            detail = f"{round(dev)} bpm above baseline"
        else:
            flag = "bad"
            detail = f"{round(dev)} bpm above baseline"

        return Signal(key="rhr_deviation", label="Resting HR", detail=detail, flag=flag)

    @staticmethod
    def _load_signal(days: list[dict]) -> Signal | None:
        strain_vals = [d["strain"] for d in days if d.get("strain") is not None]
        if len(strain_vals) < 7:
            return None

        acute = sum(strain_vals[-7:])
        chronic_total = sum(strain_vals[-28:]) if len(strain_vals) >= 28 else sum(strain_vals)
        chronic_weeks = min(len(strain_vals), 28) / 7.0
        chronic_weekly = chronic_total / chronic_weeks if chronic_weeks > 0 else 0

        if chronic_weekly <= 0:
            return Signal(
                key="load_ratio", label="Load Ratio",
                detail="No chronic load data", flag="neutral",
            )

        acwr = acute / chronic_weekly
        acwr_r = round(acwr, 2)

        if 0.8 <= acwr <= 1.3:
            flag = "good"
            detail = f"ACWR {acwr_r} — sweet spot"
        elif 0.5 <= acwr < 0.8 or 1.3 < acwr <= 1.5:
            flag = "watch"
            detail = f"ACWR {acwr_r} — {'ramping up' if acwr > 1.3 else 'detraining'}"
        else:
            flag = "bad"
            detail = f"ACWR {acwr_r} — {'spike risk' if acwr > 1.5 else 'significant detraining'}"

        return Signal(key="load_ratio", label="Load Ratio", detail=detail, flag=flag)

    @staticmethod
    def _sleep_debt_signal(days: list[dict], sleep_need_hours: float | None) -> Signal | None:
        if sleep_need_hours is None:
            sleep_need_hours = 8.0
        need_min = sleep_need_hours * 60

        recent = [d["sleep_minutes"] for d in days[-3:] if d.get("sleep_minutes") is not None]
        if not recent:
            return None

        avg = sum(recent) / len(recent)
        ratio = avg / need_min if need_min > 0 else 1.0
        diff = round(avg - need_min)

        if ratio >= 0.9:
            flag = "good"
            detail = f"On target ({round(avg)}m avg vs {round(need_min)}m need)"
        elif ratio >= 0.8:
            flag = "neutral"
            detail = f"Slightly short ({diff:+d}m vs need)"
        elif ratio >= 0.7:
            flag = "watch"
            detail = f"Sleep debt building ({diff:+d}m vs need)"
        else:
            flag = "bad"
            detail = f"Significant sleep debt ({diff:+d}m vs need)"

        return Signal(key="sleep_debt", label="Sleep Debt", detail=detail, flag=flag)

    @staticmethod
    def _determine_level(signals: list[Signal], n_days: int) -> str:
        if n_days < 7:
            return "insufficient"
        flags = [s.flag for s in signals]
        if "bad" in flags:
            return "rundown"
        if "watch" in flags:
            return "strained"
        if all(f == "good" for f in flags):
            return "primed"
        return "balanced"

    @staticmethod
    def evaluate(conn: sqlite3.Connection) -> ReadinessResult:
        today_str = date.today().isoformat()
        start_str = (date.today() - timedelta(days=27)).isoformat()
        days = get_daily_metrics_range(conn, start_str, today_str)

        if len(days) < 7:
            return ReadinessResult(
                level="insufficient",
                headline=HEADLINES["insufficient"],
                summary=SUMMARIES["insufficient"],
                acwr=None,
                signals=[],
            )

        latest = days[-1]
        hrv_baseline = get_baseline(conn, "hrv")
        rhr_baseline = get_baseline(conn, "resting_hr")

        sleep_need_str = get_profile(conn, "sleep_need_hours")
        sleep_need = float(sleep_need_str) if sleep_need_str else None

        signals: list[Signal] = []

        hrv_sig = ReadinessEngine._hrv_signal(latest.get("hrv_rmssd"), hrv_baseline)
        if hrv_sig:
            signals.append(hrv_sig)

        rhr_sig = ReadinessEngine._rhr_signal(latest.get("resting_hr"), rhr_baseline)
        if rhr_sig:
            signals.append(rhr_sig)

        load_sig = ReadinessEngine._load_signal(days)
        if load_sig:
            signals.append(load_sig)

        sleep_sig = ReadinessEngine._sleep_debt_signal(days, sleep_need)
        if sleep_sig:
            signals.append(sleep_sig)

        # Compute ACWR for response
        acwr = None
        strain_vals = [d["strain"] for d in days if d.get("strain") is not None]
        if len(strain_vals) >= 7:
            acute = sum(strain_vals[-7:])
            chronic_total = sum(strain_vals[-28:]) if len(strain_vals) >= 28 else sum(strain_vals)
            chronic_weeks = min(len(strain_vals), 28) / 7.0
            chronic_weekly = chronic_total / chronic_weeks if chronic_weeks > 0 else 0
            if chronic_weekly > 0:
                acwr = acute / chronic_weekly

        level = ReadinessEngine._determine_level(signals, len(days))

        return ReadinessResult(
            level=level,
            headline=HEADLINES[level],
            summary=SUMMARIES[level],
            acwr=acwr,
            signals=signals,
        )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/suryaprasad/projects/air_mg/backend && python -m pytest tests/test_readiness_engine.py -v`
Expected: All 5 tests PASS

- [ ] **Step 5: Add readiness endpoint and register router**

```python
# backend/src/airmg/routes/readiness.py
from __future__ import annotations

from fastapi import APIRouter

from airmg.analytics.readiness import ReadinessEngine
from airmg.config import DB_PATH
from airmg.store.db import get_connection

router = APIRouter(prefix="/api", tags=["readiness"])


@router.get("/readiness")
def readiness():
    conn = get_connection(DB_PATH)
    result = ReadinessEngine.evaluate(conn)
    conn.close()
    return result.to_dict()
```

Add to `backend/src/airmg/main.py` — import and include the router:
```python
from airmg.routes.readiness import router as readiness_router
# ... in the app setup:
app.include_router(readiness_router)
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/airmg/analytics/readiness.py backend/src/airmg/routes/readiness.py backend/tests/test_readiness_engine.py backend/src/airmg/main.py
git commit -m "feat: add ReadinessEngine with training-readiness assessment"
```

---

### Task 2: BehaviorInsights Engine

**Files:**
- Create: `backend/src/airmg/analytics/behaviors.py`
- Create: `backend/tests/test_behaviors.py`
- Modify: `backend/src/airmg/routes/insights.py`
- Modify: `backend/src/airmg/store/reads.py`

- [ ] **Step 1: Add `get_journal_entries_range` to reads.py**

Add to `backend/src/airmg/store/reads.py`:

```python
def get_journal_entries_range(conn: sqlite3.Connection, start_day: str, end_day: str) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM journal_entries WHERE day >= ? AND day <= ? ORDER BY day",
        (start_day, end_day),
    ).fetchall()
    return [dict(r) for r in rows]
```

- [ ] **Step 2: Write the test file**

```python
# backend/tests/test_behaviors.py
from airmg.analytics.behaviors import BehaviorInsights


def test_cohens_d_basic():
    with_vals = [80.0, 75.0, 82.0, 78.0, 85.0, 70.0]
    without_vals = [60.0, 65.0, 58.0, 62.0, 55.0, 68.0]
    d = BehaviorInsights._cohens_d(with_vals, without_vals)
    assert d > 1.0  # large effect


def test_cohens_d_identical():
    vals = [70.0, 72.0, 68.0, 71.0, 69.0]
    d = BehaviorInsights._cohens_d(vals, vals)
    assert abs(d) < 0.01


def test_cohens_d_empty():
    d = BehaviorInsights._cohens_d([], [70.0, 72.0])
    assert d == 0.0


def test_analyze_returns_ranked_effects():
    journal = {
        "meditation": {"2026-06-01": True, "2026-06-02": True, "2026-06-03": True,
                        "2026-06-04": True, "2026-06-05": True},
        "alcohol": {"2026-06-01": True, "2026-06-03": True, "2026-06-05": True,
                    "2026-06-07": True, "2026-06-09": True},
    }
    metrics = {
        "2026-06-01": 80.0, "2026-06-02": 85.0, "2026-06-03": 75.0,
        "2026-06-04": 82.0, "2026-06-05": 78.0, "2026-06-06": 60.0,
        "2026-06-07": 55.0, "2026-06-08": 62.0, "2026-06-09": 58.0,
        "2026-06-10": 65.0,
    }
    questions = {
        "meditation": {"question": "Did you meditate?", "category": "meditation"},
        "alcohol": {"question": "Did you drink alcohol?", "category": "alcohol"},
    }
    effects = BehaviorInsights.analyze(journal, metrics, questions, "Recovery", higher_is_better=True)
    assert len(effects) >= 1
    assert all(hasattr(e, "effect_size") for e in effects)
    # Should be sorted by |effect_size| desc
    sizes = [abs(e.effect_size) for e in effects]
    assert sizes == sorted(sizes, reverse=True)


def test_analyze_skips_small_groups():
    journal = {
        "meditation": {"2026-06-01": True, "2026-06-02": True},  # only 2 with
    }
    metrics = {f"2026-06-{d:02d}": 70.0 for d in range(1, 11)}
    questions = {"meditation": {"question": "Meditate?", "category": "meditation"}}
    effects = BehaviorInsights.analyze(journal, metrics, questions, "Recovery", higher_is_better=True)
    assert len(effects) == 0  # need min 5 per group


def test_direction_inverted_for_rhr():
    journal = {
        "caffeine": {f"2026-06-{d:02d}": True for d in range(1, 8)},
    }
    # RHR higher on caffeine days = bad (higher_is_better=False)
    metrics = {}
    for d in range(1, 15):
        day = f"2026-06-{d:02d}"
        metrics[day] = 65.0 if d < 8 else 50.0  # caffeine days have higher RHR
    questions = {"caffeine": {"question": "Had caffeine?", "category": "caffeine"}}
    effects = BehaviorInsights.analyze(journal, metrics, questions, "Resting HR", higher_is_better=False)
    assert len(effects) == 1
    assert effects[0].direction == "negative"  # higher RHR = bad
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /Users/suryaprasad/projects/air_mg/backend && python -m pytest tests/test_behaviors.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 4: Implement BehaviorInsights**

```python
# backend/src/airmg/analytics/behaviors.py
from __future__ import annotations

import math
from dataclasses import dataclass, asdict


@dataclass(frozen=True, slots=True)
class BehaviorEffect:
    question_key: str
    question: str
    category: str
    with_mean: float
    without_mean: float
    effect_size: float
    n_with: int
    n_without: int
    significant: bool
    direction: str  # "positive" | "negative" | "neutral"
    sentence: str

    def to_dict(self) -> dict:
        return asdict(self)


class BehaviorInsights:
    MIN_GROUP_SIZE = 5

    @staticmethod
    def _cohens_d(with_vals: list[float], without_vals: list[float]) -> float:
        n1, n2 = len(with_vals), len(without_vals)
        if n1 < 2 or n2 < 2:
            return 0.0
        m1 = sum(with_vals) / n1
        m2 = sum(without_vals) / n2
        var1 = sum((x - m1) ** 2 for x in with_vals) / (n1 - 1)
        var2 = sum((x - m2) ** 2 for x in without_vals) / (n2 - 1)
        pooled_sd = math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2))
        if pooled_sd < 1e-9:
            return 0.0
        return (m1 - m2) / pooled_sd

    @staticmethod
    def analyze(
        journal: dict[str, dict[str, bool]],
        metrics: dict[str, float],
        questions: dict[str, dict],
        outcome_name: str,
        higher_is_better: bool = True,
    ) -> list[BehaviorEffect]:
        all_days = set(metrics.keys())
        effects: list[BehaviorEffect] = []

        for qkey, day_answers in journal.items():
            with_days = {d for d, v in day_answers.items() if v}
            without_days = all_days - with_days

            with_vals = [metrics[d] for d in with_days if d in metrics]
            without_vals = [metrics[d] for d in without_days if d in metrics]

            if len(with_vals) < BehaviorInsights.MIN_GROUP_SIZE:
                continue
            if len(without_vals) < BehaviorInsights.MIN_GROUP_SIZE:
                continue

            d = BehaviorInsights._cohens_d(with_vals, without_vals)
            m_with = sum(with_vals) / len(with_vals)
            m_without = sum(without_vals) / len(without_vals)

            significant = abs(d) >= 0.2

            # Direction: positive d means with > without
            if abs(d) < 0.1:
                direction = "neutral"
            elif higher_is_better:
                direction = "positive" if d > 0 else "negative"
            else:
                direction = "negative" if d > 0 else "positive"

            # Sentence
            pct_diff = abs(m_with - m_without) / m_without * 100 if m_without != 0 else 0
            higher_lower = "higher" if m_with > m_without else "lower"
            q_info = questions.get(qkey, {})
            q_text = q_info.get("question", qkey)
            sentence = f"{q_text.rstrip('?')} is associated with {pct_diff:.0f}% {higher_lower} {outcome_name}"

            effects.append(BehaviorEffect(
                question_key=qkey,
                question=q_text,
                category=q_info.get("category", "general"),
                with_mean=round(m_with, 1),
                without_mean=round(m_without, 1),
                effect_size=round(d, 2),
                n_with=len(with_vals),
                n_without=len(without_vals),
                significant=significant,
                direction=direction,
                sentence=sentence,
            ))

        effects.sort(key=lambda e: abs(e.effect_size), reverse=True)
        return effects
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/suryaprasad/projects/air_mg/backend && python -m pytest tests/test_behaviors.py -v`
Expected: All 5 tests PASS

- [ ] **Step 6: Add behaviours endpoint to insights route**

Add to `backend/src/airmg/routes/insights.py`:

```python
from fastapi import Query
from airmg.analytics.behaviors import BehaviorInsights
from airmg.store.reads import get_journal_entries_range
from airmg.journal.catalog import JOURNAL_QUESTIONS


OUTCOME_MAP = {
    "recovery": ("recovery", "Recovery", True),
    "hrv": ("hrv_rmssd", "HRV", True),
    "sleep_performance": ("sleep_performance", "Sleep performance", True),
    "resting_hr": ("resting_hr", "Resting HR", False),
}


@router.get("/behaviours")
def behaviour_effects(
    outcome: str = Query("recovery", description="recovery|hrv|sleep_performance|resting_hr"),
):
    if outcome not in OUTCOME_MAP:
        return {"effects": []}

    metric_key, outcome_name, higher_is_better = OUTCOME_MAP[outcome]

    conn = get_connection(DB_PATH)
    end = date.today().isoformat()
    start = (date.today() - timedelta(days=89)).isoformat()

    days = get_daily_metrics_range(conn, start, end)
    entries = get_journal_entries_range(conn, start, end)
    conn.close()

    # Build metrics dict: day → value
    metrics = {d["day"]: d[metric_key] for d in days if d.get(metric_key) is not None}

    # Build journal dict: question_key → {day → bool}
    journal: dict[str, dict[str, bool]] = {}
    for e in entries:
        qk = e["question_key"]
        if qk not in journal:
            journal[qk] = {}
        journal[qk][e["day"]] = e["answer"] in ("true", "True", "1", True)

    # Build questions info dict
    questions = {}
    for q in JOURNAL_QUESTIONS:
        questions[q["id"]] = {"question": q["question"], "category": q["category"]}

    effects = BehaviorInsights.analyze(journal, metrics, questions, outcome_name, higher_is_better)
    return {"effects": [e.to_dict() for e in effects]}
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/airmg/analytics/behaviors.py backend/tests/test_behaviors.py backend/src/airmg/routes/insights.py backend/src/airmg/store/reads.py
git commit -m "feat: add BehaviorInsights engine and /api/insights/behaviours endpoint"
```

---

### Task 3: Sparklines, HR Trend, and Baselines Endpoints

**Files:**
- Modify: `backend/src/airmg/routes/dashboard.py`
- Create: `backend/src/airmg/routes/baselines_route.py`
- Modify: `backend/src/airmg/main.py`

- [ ] **Step 1: Add sparklines and HR trend endpoints to dashboard.py**

Replace `backend/src/airmg/routes/dashboard.py` with:

```python
from __future__ import annotations

from datetime import date, datetime, timedelta

from fastapi import APIRouter, Query

from airmg.config import DB_PATH
from airmg.store.db import get_connection
from airmg.store.reads import get_daily_metrics_range, get_today_metrics, get_samples_range

router = APIRouter(prefix="/api", tags=["dashboard"])

SPARKLINE_METRICS = [
    "recovery", "strain", "hrv_rmssd", "resting_hr",
    "sleep_minutes", "sleep_performance", "spo2", "resp_rate",
    "steps", "calories", "deep_minutes", "rem_minutes",
]


@router.get("/today")
def today():
    conn = get_connection(DB_PATH)
    metrics = get_today_metrics(conn)
    conn.close()
    if metrics is None:
        return {"status": "no_data", "message": "No data for today. Sync first."}
    return metrics


@router.get("/week")
def week():
    conn = get_connection(DB_PATH)
    end = date.today().isoformat()
    start = (date.today() - timedelta(days=6)).isoformat()
    days = get_daily_metrics_range(conn, start, end)
    conn.close()
    return {"days": days}


@router.get("/sparklines")
def sparklines(days: int = Query(14, ge=1, le=90)):
    conn = get_connection(DB_PATH)
    end = date.today().isoformat()
    start = (date.today() - timedelta(days=days - 1)).isoformat()
    rows = get_daily_metrics_range(conn, start, end)
    conn.close()

    result: dict[str, list] = {m: [] for m in SPARKLINE_METRICS}
    for row in rows:
        for m in SPARKLINE_METRICS:
            result[m].append(row.get(m))
    return result


@router.get("/hr-trend")
def hr_trend(day: str = Query(default=None, description="yyyy-MM-dd")):
    if day is None:
        day = date.today().isoformat()
    dt = datetime.strptime(day, "%Y-%m-%d")
    start_ts = int(dt.timestamp())
    end_ts = start_ts + 86400

    conn = get_connection(DB_PATH)
    samples = get_samples_range(conn, "hr", start_ts, end_ts)
    conn.close()

    if not samples:
        return {"points": [], "min": 0, "avg": 0, "max": 0}

    bucket_size = 300  # 5 minutes
    buckets: dict[int, list[float]] = {}
    for s in samples:
        bucket_ts = (s["ts"] // bucket_size) * bucket_size
        if bucket_ts not in buckets:
            buckets[bucket_ts] = []
        buckets[bucket_ts].append(s["value"])

    points = []
    all_bpm: list[float] = []
    for ts in sorted(buckets.keys()):
        vals = buckets[ts]
        mean_bpm = round(sum(vals) / len(vals), 1)
        points.append({"ts": ts, "bpm": mean_bpm})
        all_bpm.append(mean_bpm)

    return {
        "points": points,
        "min": round(min(all_bpm)),
        "avg": round(sum(all_bpm) / len(all_bpm)),
        "max": round(max(all_bpm)),
    }
```

- [ ] **Step 2: Create baselines endpoint**

```python
# backend/src/airmg/routes/baselines_route.py
from __future__ import annotations

from fastapi import APIRouter

from airmg.config import DB_PATH
from airmg.store.db import get_connection
from airmg.store.reads import get_all_baselines

router = APIRouter(prefix="/api", tags=["baselines"])


@router.get("/baselines")
def baselines():
    conn = get_connection(DB_PATH)
    rows = get_all_baselines(conn)
    conn.close()
    return {
        metric: {
            "mean": round(data["mean"], 2),
            "spread": round(data["spread"], 2),
            "status": data["status"],
        }
        for metric, data in rows.items()
    }
```

- [ ] **Step 3: Register new router in main.py**

Add to `backend/src/airmg/main.py`:
```python
from airmg.routes.baselines_route import router as baselines_router
app.include_router(baselines_router)
```

- [ ] **Step 4: Verify endpoints work**

Run: `cd /Users/suryaprasad/projects/air_mg/backend && python -c "from airmg.routes.dashboard import router; print('sparklines OK')"` and `python -c "from airmg.routes.baselines_route import router; print('baselines OK')"`
Expected: Both print OK

- [ ] **Step 5: Commit**

```bash
git add backend/src/airmg/routes/dashboard.py backend/src/airmg/routes/baselines_route.py backend/src/airmg/main.py
git commit -m "feat: add sparklines, HR trend, and baselines endpoints"
```

---

### Task 4: Workouts Summary Endpoint

**Files:**
- Modify: `backend/src/airmg/routes/workouts.py`

- [ ] **Step 1: Add summary endpoint and increase default limit**

Replace `backend/src/airmg/routes/workouts.py` with:

```python
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Query

from airmg.analytics.zones import build_zones, time_in_zones
from airmg.config import DB_PATH
from airmg.store.db import get_connection
from airmg.store.reads import get_samples_range

router = APIRouter(prefix="/api/workouts", tags=["workouts"])


@router.get("")
def list_workouts(limit: int = Query(500, le=1000), offset: int = Query(0, ge=0)):
    conn = get_connection(DB_PATH)
    rows = conn.execute(
        "SELECT * FROM workouts ORDER BY start_ts DESC LIMIT ? OFFSET ?", (limit, offset)
    ).fetchall()
    conn.close()
    return {"workouts": [dict(r) for r in rows]}


@router.get("/summary")
def workouts_summary(days: int = Query(30, ge=1, le=9999)):
    conn = get_connection(DB_PATH)
    if days >= 9999:
        cutoff_ts = 0
    else:
        cutoff = date.today() - timedelta(days=days)
        cutoff_ts = int(cutoff.strftime("%s")) if hasattr(cutoff, "strftime") else 0
        from datetime import datetime
        cutoff_ts = int(datetime.combine(cutoff, datetime.min.time()).timestamp())

    rows = conn.execute(
        "SELECT * FROM workouts WHERE start_ts >= ? ORDER BY start_ts DESC",
        (cutoff_ts,),
    ).fetchall()
    workouts = [dict(r) for r in rows]

    if not workouts:
        conn.close()
        return {
            "count": 0, "total_minutes": 0, "total_calories": 0,
            "sport_breakdown": [], "hr_zones": {},
        }

    total_min = 0
    total_cal = 0.0
    sport_data: dict[str, dict] = defaultdict(lambda: {
        "count": 0, "minutes": 0, "strain_sum": 0.0, "strain_n": 0,
        "hr_sum": 0, "hr_n": 0,
    })

    zone_set = build_zones()
    total_zones: dict[int, int] = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}

    for w in workouts:
        dur = max(0, w["end_ts"] - w["start_ts"]) // 60
        total_min += dur
        if w.get("calories"):
            total_cal += w["calories"]

        sport = w.get("type") or "Activity"
        sd = sport_data[sport]
        sd["count"] += 1
        sd["minutes"] += dur
        if w.get("strain") is not None:
            sd["strain_sum"] += w["strain"]
            sd["strain_n"] += 1
        if w.get("avg_hr") is not None:
            sd["hr_sum"] += w["avg_hr"]
            sd["hr_n"] += 1

        # HR zones for this workout
        hr_samples = get_samples_range(conn, "hr", w["start_ts"], w["end_ts"])
        if hr_samples:
            wz = time_in_zones(zone_set, hr_samples)
            for z, count in wz.items():
                total_zones[z] += count

    conn.close()

    breakdown = []
    for sport, sd in sorted(sport_data.items(), key=lambda x: x[1]["count"], reverse=True):
        breakdown.append({
            "type": sport,
            "count": sd["count"],
            "minutes": sd["minutes"],
            "avg_strain": round(sd["strain_sum"] / sd["strain_n"], 1) if sd["strain_n"] else 0,
            "avg_hr": round(sd["hr_sum"] / sd["hr_n"]) if sd["hr_n"] else 0,
        })

    return {
        "count": len(workouts),
        "total_minutes": total_min,
        "total_calories": round(total_cal),
        "sport_breakdown": breakdown,
        "hr_zones": total_zones,
    }


@router.get("/{workout_id}")
def workout_detail(workout_id: int):
    conn = get_connection(DB_PATH)
    row = conn.execute("SELECT * FROM workouts WHERE id = ?", (workout_id,)).fetchone()
    conn.close()
    if row is None:
        return {"status": "not_found"}
    return dict(row)
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/suryaprasad/projects/air_mg/backend && python -c "from airmg.routes.workouts import router; print('OK')"`
Expected: OK

- [ ] **Step 3: Commit**

```bash
git add backend/src/airmg/routes/workouts.py
git commit -m "feat: add /api/workouts/summary endpoint with sport breakdown and HR zones"
```

---

### Task 5: Pipeline Enrichment

**Files:**
- Modify: `backend/src/airmg/analytics/pipeline.py`

- [ ] **Step 1: Extend compute_daily_metrics to store resp_rate, calories, and sleep stages**

In `backend/src/airmg/analytics/pipeline.py`, add after the existing sleep stage computation block (after `sleep_minutes = duration // 60`):

```python
        # Parse sleep stages from stages_json
        import json
        if sleep_row["stages_json"]:
            try:
                stages = json.loads(sleep_row["stages_json"])
                for stage_entry in stages:
                    stage_name = stage_entry.get("stage", "")
                    stage_dur = 0
                    if "start" in stage_entry and "end" in stage_entry:
                        stage_dur = (stage_entry["end"] - stage_entry["start"]) // 60
                    elif "minutes" in stage_entry:
                        stage_dur = stage_entry["minutes"]

                    if stage_name == "deep":
                        deep_minutes = (deep_minutes or 0) + stage_dur
                    elif stage_name == "rem":
                        rem_minutes = (rem_minutes or 0) + stage_dur
                    elif stage_name == "light":
                        light_minutes = (light_minutes or 0) + stage_dur
                    elif stage_name in ("wake", "awake"):
                        wake_minutes = (wake_minutes or 0) + stage_dur
            except (json.JSONDecodeError, TypeError):
                pass
```

After the strain computation, add:

```python
    # Resp rate
    resp_data = get_samples_range(conn, "resp_rate", start_ts, end_ts)
    resp_rate = None
    if resp_data:
        resp_rate = round(sum(s["value"] for s in resp_data) / len(resp_data), 1)

    # Calories from workouts
    workout_rows = conn.execute(
        "SELECT calories FROM workouts WHERE start_ts >= ? AND start_ts < ?",
        (start_ts, end_ts),
    ).fetchall()
    calories = None
    cal_vals = [r["calories"] for r in workout_rows if r["calories"] is not None]
    if cal_vals:
        calories = round(sum(cal_vals))
```

Update the `upsert_daily_metrics` call to include the new fields:

```python
    upsert_daily_metrics(
        conn,
        {
            "day": day,
            "recovery": recovery,
            "strain": strain_val,
            "sleep_performance": sleep_perf,
            "hrv_rmssd": nightly_hrv,
            "resting_hr": rhr_val,
            "resp_rate": resp_rate,
            "sleep_minutes": sleep_minutes,
            "deep_minutes": deep_minutes,
            "rem_minutes": rem_minutes,
            "light_minutes": light_minutes,
            "wake_minutes": wake_minutes,
            "steps": steps,
            "calories": calories,
        },
    )
```

- [ ] **Step 2: Run existing pipeline tests**

Run: `cd /Users/suryaprasad/projects/air_mg/backend && python -m pytest tests/test_pipeline.py -v`
Expected: PASS (existing tests still work)

- [ ] **Step 3: Commit**

```bash
git add backend/src/airmg/analytics/pipeline.py
git commit -m "fix: enrich pipeline with resp_rate, calories, and sleep stage durations"
```

---

### Task 6: Frontend Types and Atoms

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/atoms/api.ts`

- [ ] **Step 1: Add new TypeScript interfaces to types.ts**

Append to `frontend/src/lib/types.ts`:

```typescript
export interface SparklineData {
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
  deep_minutes: (number | null)[];
  rem_minutes: (number | null)[];
}

export interface ReadinessSignal {
  key: string;
  label: string;
  detail: string;
  flag: "good" | "neutral" | "watch" | "bad";
}

export interface ReadinessResult {
  level: "primed" | "balanced" | "strained" | "rundown" | "insufficient";
  headline: string;
  summary: string;
  acwr: number | null;
  signals: ReadinessSignal[];
}

export interface HRTrendPoint {
  ts: number;
  bpm: number;
}

export interface HRTrendData {
  points: HRTrendPoint[];
  min: number;
  avg: number;
  max: number;
}

export interface BehaviorEffect {
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

export interface SportBreakdown {
  type: string;
  count: number;
  minutes: number;
  avg_strain: number;
  avg_hr: number;
}

export interface WorkoutsSummary {
  count: number;
  total_minutes: number;
  total_calories: number;
  sport_breakdown: SportBreakdown[];
  hr_zones: Record<number, number>;
}

export interface BaselineInfo {
  mean: number;
  spread: number;
  status: string;
}

export type BaselinesResponse = Record<string, BaselineInfo>;
```

- [ ] **Step 2: Add new atoms to api.ts**

Add to `frontend/src/atoms/api.ts`:

```typescript
import type {
  SparklineData,
  ReadinessResult,
  HRTrendData,
  BehaviorEffect,
  WorkoutsSummary,
  BaselinesResponse,
  DailyMetrics,
} from "../lib/types";

// Sparklines
export const sparklinesAtom = atomWithQuery(() => ({
  queryKey: ["sparklines"],
  queryFn: () => api<SparklineData>("/api/sparklines?days=14"),
}));

// Readiness
export const readinessAtom = atomWithQuery(() => ({
  queryKey: ["readiness"],
  queryFn: () => api<ReadinessResult>("/api/readiness"),
}));

// HR Trend (today)
export const hrTrendAtom = atomWithQuery(() => ({
  queryKey: ["hr-trend"],
  queryFn: () => api<HRTrendData>("/api/hr-trend"),
}));

// Baselines
export const baselinesAtom = atomWithQuery(() => ({
  queryKey: ["baselines"],
  queryFn: () => api<BaselinesResponse>("/api/baselines"),
}));

// Behaviour effects
export const behaviourOutcomeAtom = atom<"recovery" | "hrv" | "sleep_performance" | "resting_hr">("recovery");

export const behaviourEffectsAtom = atomWithQuery((get) => ({
  queryKey: ["behaviour-effects", get(behaviourOutcomeAtom)],
  queryFn: () =>
    api<{ effects: BehaviorEffect[] }>(
      `/api/insights/behaviours?outcome=${get(behaviourOutcomeAtom)}`,
    ),
}));

// Workouts range + summary
export const workoutsRangeAtom = atom<"7d" | "30d" | "90d" | "1y" | "all">("30d");

export const workoutsSummaryAtom = atomWithQuery((get) => {
  const days = { "7d": 7, "30d": 30, "90d": 90, "1y": 365, all: 9999 }[
    get(workoutsRangeAtom)
  ];
  return {
    queryKey: ["workouts-summary", days],
    queryFn: () => api<WorkoutsSummary>(`/api/workouts/summary?days=${days}`),
  };
});

// Sleep trend (30 days, dedicated to avoid coupling with Trends page)
export const sleepTrendAtom = atomWithQuery(() => {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  const start = d.toISOString().slice(0, 10);
  const end = new Date().toISOString().slice(0, 10);
  return {
    queryKey: ["sleep-trend"],
    queryFn: () =>
      api<{ days: DailyMetrics[] }>(
        `/api/trends?start=${start}&end=${end}&metrics=sleep_minutes`,
      ),
  };
});

// Year recovery (for heatmap)
export const yearRecoveryAtom = atomWithQuery(() => {
  const d = new Date();
  d.setDate(d.getDate() - 364);
  const start = d.toISOString().slice(0, 10);
  const end = new Date().toISOString().slice(0, 10);
  return {
    queryKey: ["year-recovery"],
    queryFn: () =>
      api<{ days: DailyMetrics[] }>(
        `/api/trends?start=${start}&end=${end}&metrics=recovery`,
      ),
  };
});
```

Also update `trendsRangeAtom` type to include wider ranges:

```typescript
export const trendsRangeAtom = atom<"7d" | "30d" | "90d" | "6m" | "1y" | "all">("30d");
```

And update `trendsAtom` to always fetch all core metrics and handle new ranges:

```typescript
export const trendsAtom = atomWithQuery((get) => {
  const rangeMap: Record<string, number> = {
    "7d": 7, "30d": 30, "90d": 90, "6m": 180, "1y": 365, all: 3650,
  };
  const rangeDays = rangeMap[get(trendsRangeAtom)] ?? 30;
  const d = new Date();
  d.setDate(d.getDate() - rangeDays + 1);
  const start = d.toISOString().slice(0, 10);
  const end = new Date().toISOString().slice(0, 10);
  return {
    queryKey: ["trends", start, end],
    queryFn: () =>
      api<{ days: DailyMetrics[] }>(
        `/api/trends?start=${start}&end=${end}&metrics=recovery,strain,hrv_rmssd,resting_hr,sleep_minutes,sleep_performance`,
      ),
  };
});
```

- [ ] **Step 3: Fix SleepApiResponse type issue**

In `frontend/src/atoms/api.ts`, change `SleepApiResponse` to not extend `SleepSession`:

```typescript
export interface SleepApiResponse {
  id: number;
  start_ts: number;
  end_ts: number;
  efficiency: number | null;
  resting_hr: number | null;
  avg_hrv: number | null;
  status?: string;
  sleep_minutes?: number;
  deep_minutes?: number;
  rem_minutes?: number;
  light_minutes?: number;
  wake_minutes?: number;
  sleep_performance?: number;
  stages?: StageSegment[];
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/suryaprasad/projects/air_mg/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/atoms/api.ts
git commit -m "feat: add TypeScript types and jotai atoms for NOOP-parity features"
```

---

### Task 7: Sparkline and StatTile Components

**Files:**
- Create: `frontend/src/components/charts/Sparkline.tsx`
- Create: `frontend/src/components/shared/StatTile.tsx`

- [ ] **Step 1: Create Sparkline component**

```typescript
// frontend/src/components/charts/Sparkline.tsx
interface SparklineProps {
  values: (number | null)[];
  color: string;
  width?: number;
  height?: number;
}

export function Sparkline({
  values,
  color,
  width = 80,
  height = 24,
}: SparklineProps) {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2) return null;

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const pad = 2;

  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null) continue;
    const x = (i / (values.length - 1)) * width;
    const y = pad + ((max - v) / range) * (height - pad * 2);
    points.push({ x, y });
  }

  if (points.length < 2) return null;

  const lineD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaD = `${lineD} L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="shrink-0"
    >
      <path d={areaD} fill={color} fillOpacity={0.15} />
      <path
        d={lineD}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Create StatTile component**

```typescript
// frontend/src/components/shared/StatTile.tsx
import { Sparkline } from "../charts/Sparkline";

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

export function StatTile({
  label,
  value,
  caption,
  color = "text-text-primary",
  sparkline,
  sparkColor,
  delta,
  deltaColor = "text-text-tertiary",
}: StatTileProps) {
  return (
    <div className="bg-surface-raised border-hairline rounded-xl p-3 min-h-[90px] flex justify-between">
      <div className="flex flex-col justify-between min-w-0">
        <div className="text-[11px] text-text-tertiary">{label}</div>
        <div className={`text-2xl font-bold tabular-nums ${color}`}>
          {value}
        </div>
        {caption && (
          <div className="text-[11px] text-text-tertiary">{caption}</div>
        )}
        {delta && (
          <div className={`text-[11px] ${deltaColor}`}>{delta}</div>
        )}
      </div>
      {sparkline && sparkline.length >= 2 && (
        <div className="flex items-end shrink-0 ml-2">
          <Sparkline
            values={sparkline}
            color={sparkColor ?? "#888"}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/suryaprasad/projects/air_mg/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/charts/Sparkline.tsx frontend/src/components/shared/StatTile.tsx
git commit -m "feat: add Sparkline and StatTile components"
```

---

### Task 8: SynthesisCard and ReadinessCard Components

**Files:**
- Create: `frontend/src/components/shared/SynthesisCard.tsx`
- Create: `frontend/src/components/shared/ReadinessCard.tsx`

- [ ] **Step 1: Create SynthesisCard**

```typescript
// frontend/src/components/shared/SynthesisCard.tsx
interface SynthesisCardProps {
  status: string;
  detail: string;
  statusColor: string;
}

export function SynthesisCard({ status, detail, statusColor }: SynthesisCardProps) {
  return (
    <div className="bg-surface-raised border-hairline rounded-xl p-6 flex flex-col justify-center">
      <div className="text-[11px] uppercase tracking-widest text-text-tertiary mb-2">
        Recovery
      </div>
      <div className="text-xl font-bold mb-2" style={{ color: statusColor }}>
        {status}
      </div>
      <p className="text-[13px] text-text-secondary leading-relaxed">{detail}</p>
    </div>
  );
}
```

- [ ] **Step 2: Create ReadinessCard**

```typescript
// frontend/src/components/shared/ReadinessCard.tsx
import type { ReadinessResult } from "../../lib/types";
import { Card } from "@/components/ui/card";

const LEVEL_COLORS: Record<string, string> = {
  primed: "#18C98B",
  balanced: "#18C98B",
  strained: "#F5A623",
  rundown: "#FF4F73",
  insufficient: "#666",
};

const FLAG_COLORS: Record<string, string> = {
  good: "#18C98B",
  neutral: "#666",
  watch: "#F5A623",
  bad: "#FF4F73",
};

interface ReadinessCardProps {
  result: ReadinessResult;
}

export function ReadinessCard({ result }: ReadinessCardProps) {
  if (result.level === "insufficient") return null;

  const levelColor = LEVEL_COLORS[result.level] ?? "#666";

  return (
    <Card className="border-hairline bg-surface-raised p-4 space-y-3">
      <div className="text-[11px] uppercase tracking-widest text-text-tertiary">
        Should you push today?
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: levelColor }}
          />
          <span className="font-semibold text-text-primary">
            {result.headline}
          </span>
        </div>
        {result.acwr != null && (
          <span className="text-xs text-text-tertiary tabular-nums">
            load {result.acwr.toFixed(2)}
          </span>
        )}
      </div>
      <p className="text-sm text-text-secondary">{result.summary}</p>
      {result.signals.length > 0 && (
        <>
          <div className="border-t border-hairline" />
          <div className="space-y-1.5">
            {result.signals.map((s) => (
              <div
                key={s.key}
                className="flex items-start gap-2 text-xs"
              >
                <span
                  className="inline-block w-[7px] h-[7px] rounded-full mt-1 shrink-0"
                  style={{ backgroundColor: FLAG_COLORS[s.flag] ?? "#666" }}
                />
                <span className="text-text-secondary w-[90px] shrink-0">
                  {s.label}
                </span>
                <span className="text-text-tertiary">{s.detail}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/suryaprasad/projects/air_mg/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/shared/SynthesisCard.tsx frontend/src/components/shared/ReadinessCard.tsx
git commit -m "feat: add SynthesisCard and ReadinessCard components"
```

---

### Task 9: YearHeatStrip Component

**Files:**
- Create: `frontend/src/components/charts/YearHeatStrip.tsx`

- [ ] **Step 1: Create YearHeatStrip**

```typescript
// frontend/src/components/charts/YearHeatStrip.tsx
import { useState } from "react";

interface HeatDay {
  day: string;
  value: number | null;
}

interface YearHeatStripProps {
  data: HeatDay[];
  colorScale?: (value: number) => string;
}

function defaultRecoveryColor(v: number): string {
  if (v < 33) return "#FF4F73";
  if (v < 50) return "#F5A623";
  if (v < 67) return "#E8C24B";
  if (v < 85) return "#18C98B";
  return "#2FE6A8";
}

const DAY_NAMES = ["Mon", "", "Wed", "", "Fri", "", "Sun"];
const CELL = 12;
const GAP = 2;
const STEP = CELL + GAP;
const LEFT_PAD = 28;
const TOP_PAD = 16;

export function YearHeatStrip({
  data,
  colorScale = defaultRecoveryColor,
}: YearHeatStripProps) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  const dayMap = new Map(data.map((d) => [d.day, d.value]));

  // Build 52-week grid ending today
  const today = new Date();
  const cells: { day: string; col: number; row: number; value: number | null }[] = [];
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;

  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().slice(0, 10);
    const dayOfWeek = (d.getDay() + 6) % 7; // Mon=0
    const col = Math.floor((364 - i + ((today.getDay() + 6) % 7)) / 7);
    const row = dayOfWeek;

    cells.push({ day: dayStr, col, row, value: dayMap.get(dayStr) ?? null });

    if (d.getMonth() !== lastMonth) {
      monthLabels.push({
        col,
        label: d.toLocaleDateString("en-US", { month: "short" }),
      });
      lastMonth = d.getMonth();
    }
  }

  const maxCol = Math.max(...cells.map((c) => c.col));
  const width = LEFT_PAD + (maxCol + 1) * STEP;
  const height = TOP_PAD + 7 * STEP;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 140 }}>
        {/* Month labels */}
        {monthLabels.map((m, i) => (
          <text
            key={i}
            x={LEFT_PAD + m.col * STEP}
            y={10}
            fontSize={9}
            fill="#666"
          >
            {m.label}
          </text>
        ))}
        {/* Day labels */}
        {DAY_NAMES.map((name, i) =>
          name ? (
            <text
              key={i}
              x={0}
              y={TOP_PAD + i * STEP + CELL - 2}
              fontSize={9}
              fill="#666"
            >
              {name}
            </text>
          ) : null,
        )}
        {/* Cells */}
        {cells.map((c) => (
          <rect
            key={c.day}
            x={LEFT_PAD + c.col * STEP}
            y={TOP_PAD + c.row * STEP}
            width={CELL}
            height={CELL}
            rx={2}
            fill={c.value != null ? colorScale(c.value) : "#1a1a1a"}
            fillOpacity={c.value != null ? 1 : 0.3}
            onMouseEnter={(e) => {
              const label = c.value != null ? `${c.day} — ${Math.round(c.value)}%` : c.day;
              setTooltip({
                x: LEFT_PAD + c.col * STEP + CELL / 2,
                y: TOP_PAD + c.row * STEP - 4,
                text: label,
              });
            }}
            onMouseLeave={() => setTooltip(null)}
            className="cursor-default"
          />
        ))}
        {/* Tooltip */}
        {tooltip && (
          <text
            x={tooltip.x}
            y={tooltip.y}
            textAnchor="middle"
            fontSize={10}
            fill="#ccc"
          >
            {tooltip.text}
          </text>
        )}
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/suryaprasad/projects/air_mg/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/charts/YearHeatStrip.tsx
git commit -m "feat: add YearHeatStrip calendar heatmap component"
```

---

### Task 10: BehaviourCard and HRZonesBar Components

**Files:**
- Create: `frontend/src/components/shared/BehaviourCard.tsx`
- Create: `frontend/src/components/charts/HRZonesBar.tsx`

- [ ] **Step 1: Create BehaviourCard**

```typescript
// frontend/src/components/shared/BehaviourCard.tsx
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { BehaviorEffect } from "../../lib/types";

function effectLabel(d: number): string {
  const abs = Math.abs(d);
  if (abs >= 0.8) return "Large";
  if (abs >= 0.5) return "Medium";
  return "Small";
}

interface BehaviourCardProps {
  effect: BehaviorEffect;
}

export function BehaviourCard({ effect }: BehaviourCardProps) {
  const barMax = Math.max(effect.with_mean, effect.without_mean) * 1.1 || 1;
  const withPct = (effect.with_mean / barMax) * 100;
  const withoutPct = (effect.without_mean / barMax) * 100;
  const barColor =
    effect.direction === "positive"
      ? "#18C98B"
      : effect.direction === "negative"
        ? "#FF4F73"
        : "#666";

  return (
    <Card className="border-hairline bg-surface-raised p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-text-tertiary">
            {effect.category}
          </div>
          <div className="font-semibold text-text-primary text-sm mt-0.5">
            {effect.question}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="outline"
            className={`text-xs border-hairline ${effect.significant ? "text-status-positive" : "text-text-tertiary"}`}
          >
            {effect.significant ? "Significant" : "n.s."}
          </Badge>
          <Badge variant="outline" className="text-xs border-hairline text-text-tertiary">
            {effectLabel(effect.effect_size)}
          </Badge>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="w-14 text-text-tertiary shrink-0">With</span>
          <div className="flex-1 h-4 bg-surface-inset rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${withPct}%`, backgroundColor: barColor }}
            />
          </div>
          <span className="w-10 text-right tabular-nums text-text-secondary">
            {effect.with_mean.toFixed(1)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-14 text-text-tertiary shrink-0">Without</span>
          <div className="flex-1 h-4 bg-surface-inset rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-text-tertiary"
              style={{ width: `${withoutPct}%` }}
            />
          </div>
          <span className="w-10 text-right tabular-nums text-text-secondary">
            {effect.without_mean.toFixed(1)}
          </span>
        </div>
      </div>

      <p className="text-sm text-text-secondary">{effect.sentence}</p>
      <div className="text-xs text-text-tertiary">
        n = {effect.n_with} with, {effect.n_without} without
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Create HRZonesBar**

```typescript
// frontend/src/components/charts/HRZonesBar.tsx
import { useState } from "react";

const ZONE_COLORS: Record<number, string> = {
  1: "#A3D9F5",
  2: "#7EC8E3",
  3: "#F5A623",
  4: "#E8743B",
  5: "#FF4F73",
};

const ZONE_LABELS: Record<number, string> = {
  1: "Zone 1",
  2: "Zone 2",
  3: "Zone 3",
  4: "Zone 4",
  5: "Zone 5",
};

interface HRZonesBarProps {
  zones: Record<number, number>;
}

export function HRZonesBar({ zones }: HRZonesBarProps) {
  const [hover, setHover] = useState<number | null>(null);
  const total = Object.values(zones).reduce((s, v) => s + v, 0);
  if (total === 0) return null;

  const zoneEntries = [1, 2, 3, 4, 5]
    .map((z) => ({ zone: z, count: zones[z] ?? 0 }))
    .filter((z) => z.count > 0);

  return (
    <div className="space-y-2">
      <div className="flex h-6 rounded-full overflow-hidden bg-surface-inset">
        {zoneEntries.map(({ zone, count }) => {
          const pct = (count / total) * 100;
          return (
            <div
              key={zone}
              className="h-full flex items-center justify-center text-[10px] font-medium transition-opacity"
              style={{
                width: `${pct}%`,
                backgroundColor: ZONE_COLORS[zone],
                color: zone >= 3 ? "#fff" : "#000",
                opacity: hover === null || hover === zone ? 1 : 0.4,
              }}
              onMouseEnter={() => setHover(zone)}
              onMouseLeave={() => setHover(null)}
            >
              {pct >= 8 ? `Z${zone}` : ""}
            </div>
          );
        })}
      </div>
      {hover != null && (
        <div className="text-xs text-text-secondary text-center">
          {ZONE_LABELS[hover]}: {Math.round((zones[hover] ?? 0) / 60)} min (
          {Math.round(((zones[hover] ?? 0) / total) * 100)}%)
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/suryaprasad/projects/air_mg/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/shared/BehaviourCard.tsx frontend/src/components/charts/HRZonesBar.tsx
git commit -m "feat: add BehaviourCard and HRZonesBar components"
```

---

### Task 11: Today Page Rebuild

**Files:**
- Modify: `frontend/src/pages/Today.tsx`

- [ ] **Step 1: Rewrite Today.tsx**

```typescript
// frontend/src/pages/Today.tsx
import { useAtomValue } from "jotai";
import { Card } from "@/components/ui/card";
import {
  todayMetricsAtom,
  sparklinesAtom,
  readinessAtom,
  hrTrendAtom,
  workoutsAtom,
} from "../atoms/api";
import { RecoveryGauge } from "../components/charts/RecoveryGauge";
import { TrendLine } from "../components/charts/TrendLine";
import { ReadinessCard } from "../components/shared/ReadinessCard";
import { StatTile } from "../components/shared/StatTile";
import { SynthesisCard } from "../components/shared/SynthesisCard";
import { strainColor } from "../lib/colors";
import { formatMinutes, formatScore } from "../lib/format";
import { recoveryColor } from "../lib/colors";

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function synthesisWord(score: number | null): string {
  if (score == null) return "No Data";
  if (score < 25) return "Depleted";
  if (score < 50) return "Low";
  if (score < 70) return "Steady";
  if (score < 88) return "Primed";
  return "Peak";
}

function synthesisDetail(
  recovery: number | null,
  sleepMin: number | null,
): string {
  if (recovery == null)
    return "No metrics yet. Sync your data to begin.";
  const rec =
    recovery < 50
      ? "Recovery is low"
      : recovery < 70
        ? "Recovery is steady"
        : "Recovery is strong";
  const sleep =
    sleepMin == null
      ? ""
      : sleepMin >= 420
        ? " and sleep was consistent"
        : " but sleep ran short";
  return rec + sleep + ".";
}

function formatWorkoutDuration(startTs: number, endTs: number): string {
  const mins = Math.max(0, Math.round((endTs - startTs) / 60));
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${mins}m`;
}

function formatWorkoutDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function Today() {
  const { data: today, isPending } = useAtomValue(todayMetricsAtom);
  const { data: sparklines } = useAtomValue(sparklinesAtom);
  const { data: readiness } = useAtomValue(readinessAtom);
  const { data: hrTrend } = useAtomValue(hrTrendAtom);
  const { data: workoutsData } = useAtomValue(workoutsAtom);

  const workouts = workoutsData?.workouts?.slice(0, 6) ?? [];

  if (isPending) return <div className="text-text-secondary">Loading...</div>;

  const rec = today?.recovery ?? null;
  const hrPoints =
    hrTrend?.points?.map((p) => ({
      day: new Date(p.ts * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      value: p.bpm,
    })) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Control Center</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <span className="text-sm text-text-tertiary">{greetingWord()}</span>
      </div>

      {/* Hero: Recovery Ring + Synthesis */}
      <div className="flex gap-4">
        <Card className="flex-1 border-hairline bg-surface-raised p-6 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <RecoveryGauge score={rec} size={168} />
            {rec == null && (
              <div className="text-sm text-text-tertiary">No data</div>
            )}
          </div>
        </Card>
        <div className="flex-1">
          <SynthesisCard
            status={synthesisWord(rec)}
            detail={synthesisDetail(rec, today?.sleep_minutes ?? null)}
            statusColor={rec != null ? (recoveryColor?.(rec) ?? "#18C98B") : "#666"}
          />
        </div>
      </div>

      {/* HR Trend */}
      {hrPoints.length >= 2 && (
        <Card className="border-hairline bg-surface-raised p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-text-tertiary">
                Heart Rate
              </div>
              <div className="text-xs text-text-tertiary">
                5-min avg · since midnight
              </div>
            </div>
            {hrTrend && (
              <span className="text-sm font-medium text-metric-rose">
                {hrTrend.points[hrTrend.points.length - 1]?.bpm ?? "--"} bpm
              </span>
            )}
          </div>
          <TrendLine data={hrPoints} color="#FF4F73" />
          {hrTrend && (
            <div className="flex gap-6 border-t border-hairline pt-2 text-xs text-text-tertiary">
              <span>
                Min{" "}
                <strong className="text-text-primary">{hrTrend.min}</strong>
              </span>
              <span>
                Avg{" "}
                <strong className="text-text-primary">{hrTrend.avg}</strong>
              </span>
              <span>
                Max{" "}
                <strong className="text-text-primary">{hrTrend.max}</strong>
              </span>
            </div>
          )}
        </Card>
      )}

      {/* Readiness */}
      {readiness && <ReadinessCard result={readiness} />}

      {/* Key Metrics */}
      <div>
        <div className="mb-3 text-[11px] uppercase tracking-widest text-text-tertiary">
          Key Metrics · 14-day trend
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2">
          <StatTile
            label="Recovery"
            value={rec != null ? `${Math.round(rec)}%` : "--"}
            caption={rec != null ? synthesisWord(rec) : undefined}
            color="text-accent"
            sparkline={sparklines?.recovery}
            sparkColor="#18C98B"
          />
          <StatTile
            label="Day Strain"
            value={today?.strain != null ? today.strain.toFixed(1) : "--"}
            caption="of 21"
            color={strainColor(today?.strain ?? null)}
            sparkline={sparklines?.strain}
            sparkColor="#E8743B"
          />
          <StatTile
            label="Sleep"
            value={formatMinutes(today?.sleep_minutes ?? null)}
            color="text-metric-purple"
            sparkline={sparklines?.sleep_minutes}
            sparkColor="#A879FF"
          />
          <StatTile
            label="HRV"
            value={formatScore(today?.hrv_rmssd ?? null, 0)}
            caption="ms"
            color="text-metric-purple"
            sparkline={sparklines?.hrv_rmssd}
            sparkColor="#A879FF"
          />
          <StatTile
            label="Resting HR"
            value={formatScore(today?.resting_hr ?? null, 0)}
            caption="bpm"
            color="text-metric-rose"
            sparkline={sparklines?.resting_hr}
            sparkColor="#FF4F73"
          />
          <StatTile
            label="Blood Oxygen"
            value={
              today?.spo2 != null ? `${Math.round(today.spo2)}%` : "--"
            }
            caption="SpO₂"
            color="text-metric-cyan"
            sparkline={sparklines?.spo2}
            sparkColor="#2FC7FF"
          />
          <StatTile
            label="Respiratory"
            value={formatScore(today?.resp_rate ?? null, 1)}
            caption="rpm"
            color="text-accent"
            sparkline={sparklines?.resp_rate}
            sparkColor="#18C98B"
          />
          <StatTile
            label="Steps"
            value={today?.steps?.toLocaleString() ?? "--"}
            caption="today"
            color="text-metric-cyan"
            sparkline={sparklines?.steps}
            sparkColor="#2FC7FF"
          />
          <StatTile
            label="Calories"
            value={
              today?.calories != null
                ? Math.round(today.calories).toLocaleString()
                : "--"
            }
            caption="active"
            color="text-metric-amber"
            sparkline={sparklines?.calories}
            sparkColor="#F5A623"
          />
        </div>
      </div>

      {/* Last Workouts */}
      {workouts.length > 0 && (
        <div>
          <div className="mb-3 text-[11px] uppercase tracking-widest text-text-tertiary">
            Last Workouts · Activity
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2">
            {workouts.map((w) => (
              <StatTile
                key={w.id}
                label={w.type ?? "Activity"}
                value={formatWorkoutDuration(w.start_ts, w.end_ts)}
                caption={`${formatWorkoutDate(w.start_ts)}${w.avg_hr ? ` · ${w.avg_hr} bpm` : ""}`}
                color={strainColor(w.strain ?? null)}
                delta={
                  w.calories != null
                    ? `${Math.round(w.calories)} kcal`
                    : undefined
                }
                deltaColor="text-metric-amber"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Check if `recoveryColor` exists in lib/colors.ts — if not, add it**

Check `frontend/src/lib/colors.ts` for a `recoveryColor` function. If it doesn't exist, add:

```typescript
export function recoveryColor(score: number): string {
  if (score < 33) return "#FF4F73";
  if (score < 67) return "#F5A623";
  return "#18C98B";
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/suryaprasad/projects/air_mg/frontend && npx tsc --noEmit`
Expected: No errors (fix any import issues)

- [ ] **Step 4: Start dev server and test in browser**

Run: `cd /Users/suryaprasad/projects/air_mg/frontend && npm run dev`

Open http://localhost:5173 and verify:
- Hero section shows recovery ring + synthesis card side-by-side
- HR trend chart appears if HR samples exist
- Readiness card shows if enough data
- 9 StatTiles in adaptive grid with sparklines
- Workout tiles at bottom

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Today.tsx frontend/src/lib/colors.ts
git commit -m "feat: rebuild Today page with hero ring, HR trend, readiness, sparkline tiles"
```

---

### Task 12: Sleep Page Enrichment

**Files:**
- Modify: `frontend/src/pages/Sleep.tsx`

- [ ] **Step 1: Rewrite Sleep.tsx with StatTiles, stages vs typical, and trend**

Replace the MetricCard grids and add new sections. Keep existing stage chart and date nav. Add:

1. Replace both `MetricCard` grids with a single `StatTile` grid (Performance, Efficiency, Restorative, Deep, REM, Light, HRV, Resting HR, Resp Rate) with sparklines from `sparklinesAtom`.
2. Add "Stages vs Typical" card after stage breakdown — three horizontal bars for Deep/REM/Light comparing last night to 30-day averages.
3. Add 30-day sleep trend `TrendLine` at bottom using `sleepTrendAtom`.

Import new atoms and components:
```typescript
import { useAtomValue } from "jotai";
import { Card } from "@/components/ui/card";
import { sleepDayAtom, sleepDetailAtom, sparklinesAtom, sleepTrendAtom } from "../atoms/api";
import { SleepStagesChart } from "../components/charts/SleepStagesChart";
import { TrendLine } from "../components/charts/TrendLine";
import { DateNav } from "../components/shared/DateNav";
import { StatTile } from "../components/shared/StatTile";
import { formatMinutes, formatScore } from "../lib/format";
```

Key additions to the JSX (after the stage chart card, replacing both MetricCard grids):

```tsx
{/* StatTile grid */}
<div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2">
  <StatTile label="Sleep Performance" value={session?.sleep_performance != null ? `${Math.round(session.sleep_performance)}` : "--"} caption="%" color="text-accent" sparkline={sparklines?.sleep_performance} sparkColor="#18C98B" />
  <StatTile label="Efficiency" value={session?.efficiency != null ? `${Math.round(session.efficiency <= 1 ? session.efficiency * 100 : session.efficiency)}` : "--"} caption="%" color="text-status-positive" />
  <StatTile label="Restorative" value={totalMin && deepMin != null && remMin != null ? `${Math.round(((deepMin + remMin) / totalMin) * 100)}` : "--"} caption="% deep+rem" color="text-metric-purple" />
  <StatTile label="Deep" value={formatMinutes(deepMin)} color="text-sleep-deep" sparkline={sparklines?.deep_minutes} sparkColor="#5C6FB1" />
  <StatTile label="REM" value={formatMinutes(remMin)} color="text-sleep-rem" sparkline={sparklines?.rem_minutes} sparkColor="#A879FF" />
  <StatTile label="Light" value={formatMinutes(lightMin)} color="text-sleep-light" />
  <StatTile label="HRV" value={formatScore(session?.avg_hrv ?? null, 0)} caption="ms" color="text-metric-purple" sparkline={sparklines?.hrv_rmssd} sparkColor="#A879FF" />
  <StatTile label="Resting HR" value={formatScore(session?.resting_hr ?? null)} caption="bpm" color="text-metric-rose" sparkline={sparklines?.resting_hr} sparkColor="#FF4F73" />
</div>
```

Sleep trend at bottom:
```tsx
{sleepTrendPoints.length >= 2 && (
  <Card className="border-hairline bg-surface-raised p-4 space-y-2">
    <div className="text-sm font-medium text-text-secondary">Sleep Duration · 30 days</div>
    <TrendLine data={sleepTrendPoints} color="#A879FF" />
  </Card>
)}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/suryaprasad/projects/air_mg/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Test in browser**

Navigate to Sleep page. Verify StatTiles with sparklines, sleep trend chart.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Sleep.tsx
git commit -m "feat: enrich Sleep page with StatTile grid, sparklines, and 30-day trend"
```

---

### Task 13: Trends Page Expansion

**Files:**
- Modify: `frontend/src/pages/Trends.tsx`

- [ ] **Step 1: Rewrite Trends.tsx**

Key changes:
1. Extended range buttons: 7D, 30D, 90D, 6M, 1Y, ALL
2. Hero chart stays as single-metric selector
3. Add "Supporting Metrics" section with 3 smaller TrendLine charts (HRV, RHR, Strain) always visible below hero
4. Add YearHeatStrip at bottom

```typescript
import { useMemo, useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { Card } from "@/components/ui/card";
import { TrendLine } from "../components/charts/TrendLine";
import { YearHeatStrip } from "../components/charts/YearHeatStrip";
import { trendsAtom, trendsRangeAtom, trendsMetricAtom, yearRecoveryAtom } from "../atoms/api";
```

Add ranges:
```typescript
const RANGES: Array<{ key: string; label: string }> = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "6m", label: "6M" },
  { key: "1y", label: "1Y" },
  { key: "all", label: "ALL" },
];
```

Auto-expand effect:
```typescript
useEffect(() => {
  if (!isPending && trendPoints.length === 0) {
    const rangeOrder = ["7d", "30d", "90d", "6m", "1y", "all"];
    const idx = rangeOrder.indexOf(selectedRange);
    if (idx < rangeOrder.length - 1) {
      setSelectedRange(rangeOrder[idx + 1] as typeof selectedRange);
    }
  }
}, [isPending, trendPoints.length, selectedRange, setSelectedRange]);
```

Supporting metrics section:
```tsx
{/* Supporting Metrics */}
<div className="grid gap-3 sm:grid-cols-3">
  {[
    { key: "hrv_rmssd", label: "HRV", color: "#A879FF", unit: "ms" },
    { key: "resting_hr", label: "Resting HR", color: "#FF4F73", unit: "bpm" },
    { key: "strain", label: "Strain", color: "#E8743B", unit: "", domain: [0, 21] as [number, number] },
  ].filter(m => m.key !== selectedMetric).map(m => {
    const pts = data?.days?.map(d => ({ day: d.day, value: d[m.key as keyof typeof d] as number | null })) ?? [];
    return (
      <Card key={m.key} className="border-hairline bg-surface-raised p-3 space-y-1">
        <div className="text-xs text-text-tertiary">{m.label}</div>
        {pts.length >= 2 && <TrendLine data={pts} color={m.color} domain={m.domain} />}
      </Card>
    );
  })}
</div>
```

YearHeatStrip at bottom:
```tsx
{yearData?.days && yearData.days.length > 0 && (
  <Card className="border-hairline bg-surface-raised p-4 space-y-2">
    <div className="text-sm font-medium text-text-secondary">Recovery · Past Year</div>
    <YearHeatStrip data={yearData.days.map(d => ({ day: d.day, value: d.recovery }))} />
  </Card>
)}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/suryaprasad/projects/air_mg/frontend && npx tsc --noEmit`

- [ ] **Step 3: Test in browser**

Navigate to Trends page. Verify:
- 6 range buttons work
- Hero chart + 3 supporting metric charts visible
- YearHeatStrip at bottom
- Auto-expand when range has no data

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Trends.tsx
git commit -m "feat: expand Trends with more ranges, multi-metric view, and year heatmap"
```

---

### Task 14: Insights Page — Behaviour Effects

**Files:**
- Modify: `frontend/src/pages/Insights.tsx`

- [ ] **Step 1: Add behaviour effects section to Insights.tsx**

Add imports:
```typescript
import { useAtomValue, useSetAtom } from "jotai";
import { behaviourEffectsAtom, behaviourOutcomeAtom } from "../atoms/api";
import { BehaviourCard } from "../components/shared/BehaviourCard";
```

Add outcome selector and effects list before the existing correlations section:

```tsx
{/* Behaviour Effects */}
<div className="space-y-3">
  <div className="text-[11px] uppercase tracking-widest text-text-tertiary">
    Behaviour Effects
  </div>
  <div className="flex gap-2">
    {(["recovery", "hrv", "sleep_performance", "resting_hr"] as const).map((o) => (
      <button
        key={o}
        onClick={() => setOutcome(o)}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
          selectedOutcome === o
            ? "bg-accent-muted text-accent"
            : "text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
        }`}
      >
        {o === "recovery" ? "Recovery" : o === "hrv" ? "HRV" : o === "sleep_performance" ? "Sleep" : "RHR"}
      </button>
    ))}
  </div>
  {bePending && <div className="text-text-secondary text-sm">Loading…</div>}
  {effects.length === 0 && !bePending && (
    <Card className="border-hairline bg-surface-raised p-6 text-center text-text-tertiary text-sm">
      Log more journal entries to see behaviour effects. At least 5 days with and without each behaviour needed.
    </Card>
  )}
  {effects.map((e) => (
    <BehaviourCard key={e.question_key} effect={e} />
  ))}
</div>
```

Add section header "Metric Relationships" before existing correlations:
```tsx
<div className="text-[11px] uppercase tracking-widest text-text-tertiary">
  Metric Relationships
</div>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/suryaprasad/projects/air_mg/frontend && npx tsc --noEmit`

- [ ] **Step 3: Test in browser**

Navigate to Insights page. Verify outcome selector, behaviour cards (may be empty if no journal data), correlations section below.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Insights.tsx
git commit -m "feat: add behaviour effects section to Insights page"
```

---

### Task 15: Workouts Page Enrichment

**Files:**
- Modify: `frontend/src/pages/Workouts.tsx`

- [ ] **Step 1: Rewrite Workouts.tsx with range filter, summary tiles, sport breakdown, and HR zones**

Add imports:
```typescript
import { useAtomValue, useSetAtom } from "jotai";
import { workoutsAtom, workoutsRangeAtom, workoutsSummaryAtom } from "../atoms/api";
import { StatTile } from "../components/shared/StatTile";
import { HRZonesBar } from "../components/charts/HRZonesBar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { strainColor } from "../lib/colors";
```

Key sections:

1. Range filter pill bar
2. Summary StatTiles (4 tiles: Sessions, Total Time, Calories, Most Active)
3. Sport Breakdown cards
4. HR Zones bar
5. Existing session list, filtered by range

Client-side filtering:
```typescript
const rangeDays = { "7d": 7, "30d": 30, "90d": 90, "1y": 365, all: 99999 }[selectedRange];
const cutoffTs = Math.floor(Date.now() / 1000) - rangeDays * 86400;
const filtered = workouts.filter(w => w.start_ts >= cutoffTs);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/suryaprasad/projects/air_mg/frontend && npx tsc --noEmit`

- [ ] **Step 3: Test in browser**

Navigate to Workouts page. Verify:
- Range filter buttons work
- Summary tiles show count, time, calories, most active sport
- Sport breakdown cards
- HR zones bar
- Session list filters by range

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Workouts.tsx
git commit -m "feat: enrich Workouts with range filter, summary tiles, sport breakdown, HR zones"
```

---

### Task 16: Cleanup

**Files:**
- Possibly delete: `frontend/src/hooks/useApi.ts` (if it exists and is unused)
- Possibly delete: `frontend/src/components/shared/ScoreBadge.tsx` (replaced by RecoveryGauge in hero)

- [ ] **Step 1: Check for unused imports/files**

Run: `cd /Users/suryaprasad/projects/air_mg/frontend && grep -r "useApi" src/ --include="*.tsx" --include="*.ts" -l`
Run: `cd /Users/suryaprasad/projects/air_mg/frontend && grep -r "ScoreBadge" src/ --include="*.tsx" --include="*.ts" -l`
Run: `cd /Users/suryaprasad/projects/air_mg/frontend && grep -r "WeekStrip" src/ --include="*.tsx" --include="*.ts" -l`

If any of these only appear in their own definition file, delete them.

- [ ] **Step 2: Run full TypeScript check**

Run: `cd /Users/suryaprasad/projects/air_mg/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run all backend tests**

Run: `cd /Users/suryaprasad/projects/air_mg/backend && python -m pytest -v`
Expected: All tests pass

- [ ] **Step 4: Commit cleanup**

```bash
git add -A
git commit -m "chore: remove unused useApi hook, ScoreBadge, and WeekStrip"
```
