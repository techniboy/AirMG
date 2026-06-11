from __future__ import annotations

import math

from airmg.analytics.baselines import BaselineState


class RecoveryScorer:
    W_HRV = 0.60
    W_RHR = 0.20
    W_RESP = 0.05
    W_SLEEP = 0.15

    LOGISTIC_K = 1.6
    LOGISTIC_Z0 = -0.20
    POPULATION_MEAN = 58.0

    BAND_RED_MAX = 34.0
    BAND_YELLOW_MAX = 67.0

    SLEEP_PERF_CENTER = 0.85
    SLEEP_PERF_SCALE = 0.12

    RESTING_HR_WINDOW_S = 5 * 60

    @staticmethod
    def z_score(value: float, mean: float, spread: float) -> float:
        sigma = max(1.253 * spread, 1e-9)
        return (value - mean) / sigma

    @staticmethod
    def band(score: float) -> str:
        if score < RecoveryScorer.BAND_RED_MAX:
            return "red"
        if score < RecoveryScorer.BAND_YELLOW_MAX:
            return "yellow"
        return "green"

    @staticmethod
    def resting_hr(hr_samples: list[dict], start_ts: int, end_ts: int) -> int | None:
        seg = [s for s in hr_samples if start_ts <= s["ts"] <= end_ts]
        if not seg:
            return None
        window = RecoveryScorer.RESTING_HR_WINDOW_S
        means: list[float] = []
        t = start_ts
        while t < end_ts:
            win = [s for s in seg if t <= s["ts"] < t + window]
            if win:
                means.append(sum(s["value"] for s in win) / len(win))
            t += window
        floor_val = min(means) if means else sum(s["value"] for s in seg) / len(seg)
        return round(floor_val)

    @staticmethod
    def recovery(
        hrv: float,
        rhr: float,
        resp: float | None,
        hrv_baseline: BaselineState,
        rhr_baseline: BaselineState | None,
        resp_baseline: BaselineState | None,
        sleep_perf: float | None,
    ) -> float | None:
        if not hrv_baseline.usable:
            return None

        terms: list[tuple[float, float]] = []

        # HRV: higher is better
        terms.append(
            (
                RecoveryScorer.z_score(hrv, hrv_baseline.baseline, hrv_baseline.spread),
                RecoveryScorer.W_HRV,
            )
        )

        # RHR: lower is better → invert
        if rhr_baseline is not None:
            terms.append(
                (
                    RecoveryScorer.z_score(rhr_baseline.baseline, rhr, rhr_baseline.spread),
                    RecoveryScorer.W_RHR,
                )
            )

        # Resp: lower is better, optional
        if resp is not None and resp_baseline is not None:
            terms.append(
                (
                    RecoveryScorer.z_score(resp_baseline.baseline, resp, resp_baseline.spread),
                    RecoveryScorer.W_RESP,
                )
            )

        # Sleep perf: centered at 0.85, no baseline
        if sleep_perf is not None:
            terms.append(
                (
                    (sleep_perf - RecoveryScorer.SLEEP_PERF_CENTER)
                    / RecoveryScorer.SLEEP_PERF_SCALE,
                    RecoveryScorer.W_SLEEP,
                )
            )

        if not terms:
            return None

        total_weight = sum(w for _, w in terms)
        if total_weight <= 0:
            return None

        z = sum(zi * wi for zi, wi in terms) / total_weight
        score = 100.0 / (
            1.0 + math.exp(-RecoveryScorer.LOGISTIC_K * (z - RecoveryScorer.LOGISTIC_Z0))
        )
        return max(0.0, min(100.0, score))
