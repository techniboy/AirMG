# backend/src/airmg/analytics/readiness.py
from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

from airmg.store.reads import get_baseline, get_daily_metrics_range, get_profile

# ---------------------------------------------------------------------------
# Lookup tables
# ---------------------------------------------------------------------------

HEADLINES: dict[str, str] = {
    "primed": "You're primed — go for it.",
    "balanced": "Looking balanced — train with intention.",
    "strained": "Watch the load — ease into today.",
    "rundown": "Your body needs recovery time.",
    "insufficient": "Not enough data yet — keep logging.",
}

SUMMARIES: dict[str, str] = {
    "primed": (
        "HRV is elevated above your baseline, resting heart rate is low, "
        "strain load is well-managed, and your sleep debt is minimal. "
        "Today is a great day to push hard."
    ),
    "balanced": (
        "Most signals are within your normal range. "
        "No red flags, but nothing exceptional either — "
        "a steady training session is a safe bet."
    ),
    "strained": (
        "One or more signals are trending toward the warning zone. "
        "Consider a lower-intensity session or extra recovery focus today."
    ),
    "rundown": (
        "Multiple signals are in the red. "
        "Your body is telling you it needs rest — prioritise sleep, "
        "nutrition, and a very light (or no) training day."
    ),
    "insufficient": (
        "You need at least 7 days of data for a reliable readiness score. "
        "Keep logging daily and check back soon."
    ),
}


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class Signal:
    key: str
    label: str
    detail: str
    flag: str  # "good" | "neutral" | "watch" | "bad"


@dataclass
class ReadinessResult:
    level: str  # "primed" | "balanced" | "strained" | "rundown" | "insufficient"
    headline: str
    summary: str
    acwr: float | None
    signals: list[Signal] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "level": self.level,
            "headline": self.headline,
            "summary": self.summary,
            "acwr": self.acwr,
            "signals": [
                {"key": s.key, "label": s.label, "detail": s.detail, "flag": s.flag}
                for s in self.signals
            ],
        }


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

_FLAG_RANK: dict[str, int] = {"good": 0, "neutral": 1, "watch": 2, "bad": 3}


class ReadinessEngine:
    """Compute a readiness level from the last 28 days of daily_metrics."""

    # ------------------------------------------------------------------
    # Signal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _hrv_signal(rows: list[dict], hrv_baseline: dict | None) -> Signal:
        """Z-score of today's HRV vs baseline (RMSSD spread → SD via ×1.253)."""
        today_hrv = next(
            (r["hrv_rmssd"] for r in reversed(rows) if r.get("hrv_rmssd") is not None),
            None,
        )

        if today_hrv is None or hrv_baseline is None:
            return Signal(
                key="hrv",
                label="HRV",
                detail="No HRV data available.",
                flag="neutral",
            )

        mean = hrv_baseline["mean"]
        spread = hrv_baseline["spread"]
        sigma = max(1.253 * spread, 1e-9)
        z = (today_hrv - mean) / sigma

        if z > 0:
            flag, detail = "good", f"HRV is above baseline (z={z:.2f})."
        elif z > -0.5:
            flag, detail = "neutral", f"HRV is near baseline (z={z:.2f})."
        elif z > -1.0:
            flag, detail = "watch", f"HRV is below baseline (z={z:.2f})."
        else:
            flag, detail = "bad", f"HRV is well below baseline (z={z:.2f})."

        return Signal(key="hrv", label="HRV", detail=detail, flag=flag)

    @staticmethod
    def _rhr_signal(rows: list[dict], rhr_baseline: dict | None) -> Signal:
        """Deviation of today's RHR vs baseline mean."""
        today_rhr = next(
            (r["resting_hr"] for r in reversed(rows) if r.get("resting_hr") is not None),
            None,
        )

        if today_rhr is None or rhr_baseline is None:
            return Signal(
                key="rhr",
                label="Resting HR",
                detail="No RHR data available.",
                flag="neutral",
            )

        deviation = today_rhr - rhr_baseline["mean"]

        if deviation <= 0:
            flag, detail = "good", f"RHR is at or below baseline ({deviation:+.1f} bpm)."
        elif deviation <= 2:
            flag, detail = "neutral", f"RHR is slightly elevated ({deviation:+.1f} bpm)."
        elif deviation <= 4:
            flag, detail = "watch", f"RHR is noticeably elevated ({deviation:+.1f} bpm)."
        else:
            flag, detail = "bad", f"RHR is significantly elevated ({deviation:+.1f} bpm)."

        return Signal(key="rhr", label="Resting HR", detail=detail, flag=flag)

    @staticmethod
    def _load_signal(rows: list[dict]) -> tuple[Signal, float | None]:
        """ACWR = acute (7d) / chronic (28d / 4)."""
        strains = [r.get("strain") for r in rows]
        n_days = len([s for s in strains if s is not None])

        recent_7 = [r.get("strain") for r in rows[-7:]]
        acute = sum(s for s in recent_7 if s is not None)
        chronic_total = sum(s for s in strains if s is not None)

        if chronic_total == 0 or n_days == 0:
            return (
                Signal(
                    key="load",
                    label="Training Load",
                    detail="No strain data available.",
                    flag="neutral",
                ),
                None,
            )

        chronic_avg = chronic_total / (n_days / 7)
        acwr = acute / chronic_avg if chronic_avg > 0 else 0.0

        if 0.8 <= acwr <= 1.3:
            flag = "good"
            detail = f"Acute:chronic load ratio is optimal (ACWR={acwr:.2f})."
        elif (0.5 <= acwr < 0.8) or (1.3 < acwr <= 1.5):
            flag = "watch"
            detail = f"Load ratio is in the caution zone (ACWR={acwr:.2f})."
        else:
            flag = "bad"
            detail = f"Load ratio is outside safe range (ACWR={acwr:.2f})."

        return Signal(key="load", label="Training Load", detail=detail, flag=flag), acwr

    @staticmethod
    def _sleep_debt_signal(rows: list[dict], sleep_need_minutes: float) -> Signal:
        """Average sleep minutes over last 3 days vs sleep need."""
        last_3 = [r.get("sleep_minutes") for r in rows[-3:]]
        valid = [s for s in last_3 if s is not None]

        if not valid or sleep_need_minutes <= 0:
            return Signal(
                key="sleep_debt",
                label="Sleep Debt",
                detail="No sleep data available.",
                flag="neutral",
            )

        avg_sleep = sum(valid) / len(valid)
        ratio = avg_sleep / sleep_need_minutes

        if ratio >= 0.90:
            flag = "good"
            detail = f"Sleep is meeting your need ({ratio*100:.0f}% of target)."
        elif ratio >= 0.80:
            flag = "neutral"
            detail = f"Slightly short on sleep ({ratio*100:.0f}% of target)."
        elif ratio >= 0.70:
            flag = "watch"
            detail = f"Noticeably short on sleep ({ratio*100:.0f}% of target)."
        else:
            flag = "bad"
            detail = f"Significant sleep debt ({ratio*100:.0f}% of target)."

        return Signal(key="sleep_debt", label="Sleep Debt", detail=detail, flag=flag)

    # ------------------------------------------------------------------
    # Main evaluate method
    # ------------------------------------------------------------------

    @staticmethod
    def evaluate(conn: sqlite3.Connection) -> ReadinessResult:
        today = date.today()
        start_28 = (today - timedelta(days=28)).isoformat()
        end_today = today.isoformat()

        rows = get_daily_metrics_range(conn, start_28, end_today)

        # Insufficient data gate
        if len(rows) < 7:
            return ReadinessResult(
                level="insufficient",
                headline=HEADLINES["insufficient"],
                summary=SUMMARIES["insufficient"],
                acwr=None,
                signals=[],
            )

        hrv_baseline = get_baseline(conn, "hrv")
        rhr_baseline = get_baseline(conn, "rhr")

        sleep_need_str = get_profile(conn, "sleep_need_hours")
        sleep_need_hours = float(sleep_need_str) if sleep_need_str else 8.0
        sleep_need_minutes = sleep_need_hours * 60.0

        # Build signals
        hrv_sig = ReadinessEngine._hrv_signal(rows, hrv_baseline)
        rhr_sig = ReadinessEngine._rhr_signal(rows, rhr_baseline)
        load_sig, acwr = ReadinessEngine._load_signal(rows)
        sleep_sig = ReadinessEngine._sleep_debt_signal(rows, sleep_need_minutes)

        signals = [hrv_sig, rhr_sig, load_sig, sleep_sig]

        # Determine level
        flags = [s.flag for s in signals]
        bad_count = flags.count("bad")
        watch_count = flags.count("watch")

        if bad_count >= 1:
            level = "rundown"
        elif watch_count >= 1:
            level = "strained"
        elif all(f == "good" for f in flags):
            level = "primed"
        else:
            level = "balanced"

        return ReadinessResult(
            level=level,
            headline=HEADLINES[level],
            summary=SUMMARIES[level],
            acwr=acwr,
            signals=signals,
        )
