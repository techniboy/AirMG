from __future__ import annotations

import math

MIN_READINGS = 600
MAX_STRAIN = 21.0
STRAIN_DENOMINATOR = 7201.0
DEFAULT_AGE = 30
DEFAULT_RESTING_HR = 60.0

EDWARDS_ZONES: list[tuple[float, int]] = [
    (90.0, 5),
    (80.0, 4),
    (70.0, 3),
    (60.0, 2),
    (50.0, 1),
]


def tanaka_hrmax(age: float) -> float:
    return 208.0 - 0.7 * age


def pct_hrr(bpm: float, resting_hr: float, hr_reserve: float) -> float:
    pct = (bpm - resting_hr) / hr_reserve * 100.0
    return max(0.0, min(100.0, pct))


def zone_weight(bpm: float, resting_hr: float, hr_reserve: float) -> int:
    pct = pct_hrr(bpm, resting_hr, hr_reserve)
    for threshold, weight in EDWARDS_ZONES:
        if pct >= threshold:
            return weight
    return 0


def trimp_to_strain(trimp: float, denominator: float = STRAIN_DENOMINATOR) -> float:
    if trimp <= 0:
        return 0
    value = MAX_STRAIN * math.log(trimp + 1.0) / math.log(denominator)
    return round(value * 100) / 100


# Gaps longer than this are sensor-off time, not sustained effort
MAX_SAMPLE_GAP_S = 300.0


def strain(
    hr_samples: list[dict],
    resting_hr: float,
    age: int = DEFAULT_AGE,
    max_hr: float | None = None,
) -> float | None:
    if len(hr_samples) < MIN_READINGS:
        return None

    hrmax = max_hr if max_hr is not None else tanaka_hrmax(float(age))
    hr_reserve = hrmax - resting_hr
    if hr_reserve <= 0:
        return None

    # Per-sample duration: each reading counts until the next one arrives,
    # capped so recording gaps don't inflate TRIMP.
    trimp = 0.0
    prev_dt_s = 60.0
    for i, s in enumerate(hr_samples):
        if i + 1 < len(hr_samples):
            gap = hr_samples[i + 1]["ts"] - s["ts"]
            dt_s = prev_dt_s if gap <= 0 else min(float(gap), MAX_SAMPLE_GAP_S)
            prev_dt_s = dt_s
        else:
            dt_s = prev_dt_s
        bpm = float(s["value"])
        w = zone_weight(bpm, resting_hr, hr_reserve)
        trimp += w * (dt_s / 60.0)

    return trimp_to_strain(trimp)
