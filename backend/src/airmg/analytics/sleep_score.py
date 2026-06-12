from __future__ import annotations

from dataclasses import dataclass


@dataclass
class SleepScore:
    total: float
    duration: float
    efficiency: float
    architecture: float
    autonomic: float

    @property
    def rounded(self) -> int:
        return max(0, min(100, round(self.total)))


# Ideal ranges from sleep medicine literature (Walker, AASM guidelines)
TARGET_SLEEP_MIN = 480  # 8 hours
MIN_ACCEPTABLE_MIN = 360  # 6 hours
DEEP_IDEAL_LOW = 0.13  # 13-23% of total sleep
DEEP_IDEAL_HIGH = 0.23
REM_IDEAL_LOW = 0.20  # 20-25%
REM_IDEAL_HIGH = 0.25

W_DURATION = 0.30
W_EFFICIENCY = 0.20
W_ARCHITECTURE = 0.25
W_AUTONOMIC = 0.25


def _clamp(v: float) -> float:
    return max(0.0, min(1.0, v))


def _duration_score(sleep_min: int, target: int = TARGET_SLEEP_MIN) -> float:
    if sleep_min >= target:
        return 1.0
    if sleep_min <= MIN_ACCEPTABLE_MIN:
        return sleep_min / MIN_ACCEPTABLE_MIN * 0.5
    return 0.5 + 0.5 * (sleep_min - MIN_ACCEPTABLE_MIN) / (target - MIN_ACCEPTABLE_MIN)


def _efficiency_score(efficiency: float) -> float:
    if efficiency >= 0.90:
        return 1.0
    if efficiency >= 0.85:
        return 0.7 + (efficiency - 0.85) / 0.05 * 0.3
    return max(0.0, efficiency / 0.85 * 0.7)


def _band_score(actual_pct: float, low: float, high: float) -> float:
    if low <= actual_pct <= high:
        return 1.0
    if actual_pct < low:
        return _clamp(actual_pct / low)
    overshoot = actual_pct - high
    return _clamp(1.0 - overshoot / high)


def _architecture_score(
    deep_min: int | None,
    rem_min: int | None,
    total_min: int,
) -> float:
    if total_min <= 0:
        return 0.5
    scores = []
    if deep_min is not None:
        scores.append(_band_score(deep_min / total_min, DEEP_IDEAL_LOW, DEEP_IDEAL_HIGH))
    if rem_min is not None:
        scores.append(_band_score(rem_min / total_min, REM_IDEAL_LOW, REM_IDEAL_HIGH))
    if not scores:
        return 0.5
    return sum(scores) / len(scores)


def _autonomic_score(
    hrv: float | None,
    rhr: float | None,
    hrv_baseline: float | None,
    hrv_spread: float | None,
    rhr_baseline: float | None,
    rhr_spread: float | None,
) -> float:
    scores = []
    if hrv is not None and hrv_baseline is not None and hrv_spread and hrv_spread > 0:
        z = (hrv - hrv_baseline) / hrv_spread
        scores.append(_clamp(0.5 + z * 0.25))
    if rhr is not None and rhr_baseline is not None and rhr_spread and rhr_spread > 0:
        z = (rhr_baseline - rhr) / rhr_spread
        scores.append(_clamp(0.5 + z * 0.25))
    if not scores:
        return 0.5
    return sum(scores) / len(scores)


def compute_sleep_score(
    sleep_min: int,
    efficiency: float | None,
    deep_min: int | None,
    rem_min: int | None,
    hrv: float | None,
    rhr: float | None,
    hrv_baseline: float | None,
    hrv_spread: float | None,
    rhr_baseline: float | None,
    rhr_spread: float | None,
    target_min: int = TARGET_SLEEP_MIN,
) -> SleepScore:
    dur = _duration_score(sleep_min, target_min)
    eff = _efficiency_score(efficiency) if efficiency is not None else 0.5
    arch = _architecture_score(deep_min, rem_min, sleep_min)
    auto = _autonomic_score(hrv, rhr, hrv_baseline, hrv_spread, rhr_baseline, rhr_spread)

    total = (
        dur * W_DURATION
        + eff * W_EFFICIENCY
        + arch * W_ARCHITECTURE
        + auto * W_AUTONOMIC
    ) * 100

    return SleepScore(
        total=total,
        duration=dur * 100,
        efficiency=eff * 100,
        architecture=arch * 100,
        autonomic=auto * 100,
    )
