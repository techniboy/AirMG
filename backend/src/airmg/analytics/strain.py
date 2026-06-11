from __future__ import annotations

import math
from typing import ClassVar


class StrainScorer:
    MIN_READINGS = 600
    MAX_STRAIN = 21.0
    STRAIN_DENOMINATOR = 7201.0
    DEFAULT_AGE = 30
    DEFAULT_RESTING_HR = 60.0
    HRMAX_MIN_SAMPLES = 600
    HRMAX_PERCENTILE = 99.5

    EDWARDS_ZONES: ClassVar[list[tuple[float, int]]] = [
        (90.0, 5),
        (80.0, 4),
        (70.0, 3),
        (60.0, 2),
        (50.0, 1),
    ]

    @staticmethod
    def tanaka_hrmax(age: float) -> float:
        return 208.0 - 0.7 * age

    @staticmethod
    def default_max_hr(age: int = DEFAULT_AGE) -> int:
        return 220 - age

    @staticmethod
    def percentile(sorted_values: list[float], pct: float) -> float:
        n = len(sorted_values)
        if n == 0:
            return 0
        if n == 1:
            return sorted_values[0]
        position = (pct / 100.0) * (n - 1)
        lower = int(position)
        upper = min(lower + 1, n - 1)
        frac = position - lower
        return sorted_values[lower] + frac * (sorted_values[upper] - sorted_values[lower])

    @staticmethod
    def estimate_hrmax(hr_history: list[float], age: float | None) -> tuple[float, str]:
        n = len(hr_history)
        tanaka = StrainScorer.tanaka_hrmax(age) if age is not None else None
        if n >= StrainScorer.HRMAX_MIN_SAMPLES:
            observed = StrainScorer.percentile(sorted(hr_history), StrainScorer.HRMAX_PERCENTILE)
            if tanaka is None:
                return (observed, "observed")
            return (observed, "observed") if observed >= tanaka else (tanaka, "tanaka")
        if tanaka is not None:
            return (tanaka, "tanaka")
        return (0.0, "unknown")

    @staticmethod
    def pct_hrr(bpm: float, resting_hr: float, hr_reserve: float) -> float:
        pct = (bpm - resting_hr) / hr_reserve * 100.0
        return max(0.0, min(100.0, pct))

    @staticmethod
    def zone_weight(bpm: float, resting_hr: float, hr_reserve: float) -> int:
        pct = (bpm - resting_hr) / hr_reserve * 100.0
        for threshold, weight in StrainScorer.EDWARDS_ZONES:
            if pct >= threshold:
                return weight
        return 0

    @staticmethod
    def trimp_to_strain(trimp: float, denominator: float = STRAIN_DENOMINATOR) -> float:
        if trimp <= 0:
            return 0
        value = StrainScorer.MAX_STRAIN * math.log(trimp + 1.0) / math.log(denominator)
        return round(value * 100) / 100

    @staticmethod
    def strain(
        hr_samples: list[dict],
        resting_hr: float,
        age: int = DEFAULT_AGE,
        method: str = "edwards",
    ) -> float | None:
        if len(hr_samples) < StrainScorer.MIN_READINGS:
            return None

        hrmax = StrainScorer.tanaka_hrmax(float(age))
        hr_reserve = hrmax - resting_hr
        if hr_reserve <= 0:
            return None

        if len(hr_samples) >= 2:
            sample_dur_min = abs(hr_samples[1]["ts"] - hr_samples[0]["ts"]) / 60.0
            if sample_dur_min <= 0:
                sample_dur_min = 1.0 / 60.0
        else:
            sample_dur_min = 1.0 / 60.0

        trimp = 0.0
        for s in hr_samples:
            bpm = float(s["value"])
            w = StrainScorer.zone_weight(bpm, resting_hr, hr_reserve)
            trimp += w * sample_dur_min

        return StrainScorer.trimp_to_strain(trimp)
